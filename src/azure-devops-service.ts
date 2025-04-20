import { DefaultAzureCredential } from "@azure/identity";
import { AzureDevOpsGroup, AzureDevOpsPermission, EntraGroup, PermissionPolicy, PermissionType, PermissionTypeMap, ProjectReference } from "./types.js";
import fetch from "node-fetch";

// Update AzureDevOpsGroup interface to include descriptor
interface SecurityNamespacesResponse {
  value: Array<{
    namespaceId: string;
    name: string;
    displayName: string;
    description: string;
    actions: Array<{
      bit: number;
      name: string;
      displayName: string;
      description: string;
    }>;
  }>;
}

export class AzureDevOpsService {
  private credential: DefaultAzureCredential;
  private token: string | null = null;
  
  constructor() {
    this.credential = new DefaultAzureCredential();
  }

  private async getToken(): Promise<string> {
    if (!this.token) {
      // Getting token for Graph API scope - needed for Entra Groups
      const accessToken = await this.credential.getToken("https://graph.microsoft.com/.default");
      this.token = accessToken.token;
    }
    return this.token;
  }

  private async getAzDevOpsToken(): Promise<string> {
    // Azure DevOps requires a different scope
    const accessToken = await this.credential.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default"); // Azure DevOps scope
    return accessToken.token;
  }

  // Fetch Entra group by name
  async getEntraGroupByName(groupName: string): Promise<EntraGroup | null> {
    const token = await this.getToken();
    
    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${groupName}'`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get Entra group: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { value: EntraGroup[] };
      
      if (data.value && data.value.length > 0) {
        return data.value[0];
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching Entra group:", error);
      throw error;
    }
  }

  // List Azure DevOps projects in an organization
  async listProjects(orgName: string): Promise<ProjectReference[]> {
    const token = await this.getAzDevOpsToken();
    
    try {
      const response = await fetch(
        `https://dev.azure.com/${orgName}/_apis/projects?api-version=7.2`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list projects: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { value: ProjectReference[] };
      return data.value;
    } catch (error) {
      console.error("Error listing projects:", error);
      throw error;
    }
  }

  // Get a specific project
  async getProject(orgName: string, projectName: string): Promise<ProjectReference | null> {
    const projects = await this.listProjects(orgName);
    return projects.find(p => p.name === projectName) || null;
  }

  // Add Entra group to Azure DevOps
  async addEntraGroupToAzDevOps(orgName: string, entraGroupId: string): Promise<AzureDevOpsGroup & { descriptor: string } | null> {
    const token = await this.getAzDevOpsToken();
    
    try {
      const response = await fetch(
        `https://vssps.dev.azure.com/${orgName}/_apis/graph/groups?api-version=7.2-preview.1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            originId: entraGroupId,
            displayName: `EntraGroup_${entraGroupId.substring(0, 8)}`, // Simplified display name
            description: "Added via MCP Permission Manager",
            origin: "aad" // Azure Active Directory (Entra ID)
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add Entra group to Azure DevOps: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const group = await response.json() as AzureDevOpsGroup & { descriptor: string };
      return group;
    } catch (error) {
      console.error("Error adding Entra group to Azure DevOps:", error);
      throw error;
    }
  }

  // Set permissions for a group on a project
  async setGroupPermissions(
    orgName: string, 
    projectId: string, 
    groupDescriptor: string, 
    permissionType: PermissionType
  ): Promise<boolean> {
    const token = await this.getAzDevOpsToken();
    const roleName = PermissionTypeMap[permissionType];
    
    try {
      // First, we need to get the project security namespace
      const securityNamespaceResponse = await fetch(
        `https://dev.azure.com/${orgName}/_apis/securitynamespaces?api-version=7.2`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!securityNamespaceResponse.ok) {
        throw new Error(`Failed to get security namespaces: ${securityNamespaceResponse.status}`);
      }

      const securityNamespaces = await securityNamespaceResponse.json() as SecurityNamespacesResponse;
      const projectNamespace = securityNamespaces.value.find((ns) => ns.name === "Project");
      
      if (!projectNamespace) {
        throw new Error("Project security namespace not found");
      }

      // Now we apply the permission
      const response = await fetch(
        `https://dev.azure.com/${orgName}/_apis/accesscontrollists/${projectNamespace.namespaceId}?api-version=7.2`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: `$PROJECT:${projectId}`,
            accessControlEntries: [
              {
                descriptor: groupDescriptor,
                allow: 31, // Numeric value representing permission level, varies by namespace and permission type
                deny: 0,
                extendedInfo: {
                  effectiveAllow: 31,
                  effectiveDeny: 0,
                  inheritedAllow: 0,
                  inheritedDeny: 0
                }
              }
            ]
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to set permissions: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return true;
    } catch (error) {
      console.error("Error setting permissions:", error);
      throw error;
    }
  }

  // Main method to apply a permission policy
  async applyPermissionPolicy(policy: PermissionPolicy): Promise<{ success: boolean, message: string }> {
    try {
      // 1. Get the Entra group
      const entraGroup = await this.getEntraGroupByName(policy.entra_group_name);
      if (!entraGroup) {
        return { success: false, message: `Entra group '${policy.entra_group_name}' not found` };
      }
      
      // 2. Get the project
      const project = await this.getProject(policy.org_name, policy.project_name);
      if (!project) {
        return { success: false, message: `Project '${policy.project_name}' not found in organization ${policy.org_name}` };
      }
      
      // 3. Add the Entra group to Azure DevOps (if not already added)
      const azDevOpsGroup = await this.addEntraGroupToAzDevOps(policy.org_name, entraGroup.id);
      if (!azDevOpsGroup) {
        return { success: false, message: "Failed to add Entra group to Azure DevOps" };
      }
      
      // 4. Set the permissions
      const result = await this.setGroupPermissions(
        policy.org_name,
        project.id,
        azDevOpsGroup.descriptor,
        policy.type_of_permission
      );
      
      if (result) {
        return { 
          success: true, 
          message: `Successfully applied '${policy.type_of_permission}' permissions to Entra group '${policy.entra_group_name}' for project '${policy.project_name}'` 
        };
      } else {
        return { success: false, message: "Failed to apply permissions" };
      }
    } catch (error) {
      console.error("Error applying permission policy:", error);
      return { success: false, message: `Error: ${(error as Error).message}` };
    }
  }
} 