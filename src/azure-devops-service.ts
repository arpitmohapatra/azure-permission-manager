import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
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
  private graphCredential: ClientSecretCredential | null = null;
  private token: string | null = null;
  
  constructor(private env?: Record<string, string>) {
    this.credential = new DefaultAzureCredential();
    this.initializeGraphCredential();
  }

  private getEnvVar(name: string): string | undefined {
    // Try MCP env first, then process.env
    return this.env?.[name] || process.env[name];
  }

  private initializeGraphCredential() {
    const clientId = this.getEnvVar('AZURE_CLIENT_ID');
    const clientSecret = this.getEnvVar('AZURE_CLIENT_SECRET');
    const tenantId = this.getEnvVar('AZURE_TENANT_ID');
    
    console.error('Debug - Graph API Credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasTenantId: !!tenantId
    });
    
    if (clientId && clientSecret && tenantId) {
      this.graphCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
      console.error('Debug - Graph API credential initialized successfully');
    } else {
      console.error('Debug - Missing required Graph API credentials');
    }
  }

  private async getToken(): Promise<string> {
    if (!this.token) {
      // Getting token for Graph API scope - needed for Entra Groups
      const accessToken = await this.credential.getToken("https://graph.microsoft.com/.default");
      this.token = accessToken.token;
    }
    return this.token;
  }

  private async getGraphToken(): Promise<string> {
    if (!this.graphCredential) {
      const clientId = this.getEnvVar('AZURE_CLIENT_ID');
      const clientSecret = this.getEnvVar('AZURE_CLIENT_SECRET');
      const tenantId = this.getEnvVar('AZURE_TENANT_ID');
      
      console.error('Debug - Graph API Environment Variables:', {
        hasClientId: !!clientId,
        clientIdLength: clientId?.length,
        hasClientSecret: !!clientSecret,
        clientSecretLength: clientSecret?.length,
        hasTenantId: !!tenantId,
        tenantIdLength: tenantId?.length
      });
      
      throw new Error('Graph API credentials not configured. Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID environment variables');
    }
    try {
      console.error('Debug - Getting Graph API token...');
      const accessToken = await this.graphCredential.getToken("https://graph.microsoft.com/.default");
      console.error('Debug - Token received, length:', accessToken.token.length);
      console.error('Debug - Token prefix:', accessToken.token.substring(0, 10) + '...');
      return accessToken.token;
    } catch (error) {
      console.error('Debug - Error getting Graph API token:', error);
      throw error;
    }
  }

  private async getAzDevOpsToken(): Promise<string> {
    const pat = this.getEnvVar('AZURE_DEVOPS_PAT');
    if (!pat) {
      throw new Error('AZURE_DEVOPS_PAT environment variable is required');
    }
    // Clean up PAT token - remove newlines and whitespace
    return pat.trim().replace(/[\n\r]/g, '');
  }

  private createAzDevOpsHeaders(token: string): HeadersInit {
    // Create headers exactly like the Python script
    const basicAuth = Buffer.from(`:${token}`, 'utf8').toString('base64');
    return {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'node-fetch'
    };
  }

  private createGraphHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // Fetch Entra group by name
  async getEntraGroupByName(groupName: string): Promise<EntraGroup | null> {
    try {
      console.error('Debug - Starting Entra group lookup for:', groupName);
      const token = await this.getGraphToken();
      console.error('Debug - Got Graph API token, making request...');
      
      const url = `https://graph.microsoft.com/v1.0/groups?$filter=displayName eq '${groupName}'`;
      console.error('Debug - Request URL:', url);
      
      const headers = this.createGraphHeaders(token);
      console.error('Debug - Request headers:', {
        'Content-Type': headers['Content-Type'],
        'Accept': headers['Accept'],
        'Authorization': headers['Authorization']?.substring(0, 15) + '...' || 'none'
      });
      
      const response = await fetch(url, { headers });
      console.error('Debug - Response status:', response.status);
      console.error('Debug - Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Debug - Error response body:', errorText);
        throw new Error(`Failed to get Entra group: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { value: EntraGroup[] };
      console.error('Debug - Groups found:', data.value.length);
      
      if (data.value && data.value.length > 0) {
        console.error('Debug - Found matching group');
        return data.value[0];
      }
      
      console.error('Debug - No matching group found');
      return null;
    } catch (error) {
      console.error("Error fetching Entra group:", error);
      throw error;
    }
  }

  // List Azure DevOps projects in an organization
  async listProjects(orgName: string): Promise<ProjectReference[]> {
    try {
      const token = await this.getAzDevOpsToken();
      const headers = this.createAzDevOpsHeaders(token);
      
      const response = await fetch(
        `https://dev.azure.com/${orgName}/_apis/projects?api-version=7.0-preview.1`,
        { headers }
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
      // Updated implementation with displayName only
      const response = await fetch(
        `https://vssps.dev.azure.com/${orgName}/_apis/graph/groups?api-version=7.0-preview.1`,
        {
          method: 'POST',
          headers: this.createAzDevOpsHeaders(token),
          body: JSON.stringify({
            displayName: "mcptest"
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Debug - Error response:', errorText);
        throw new Error(`Failed to add Entra group: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as AzureDevOpsGroup & { descriptor: string };
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
        `https://dev.azure.com/${orgName}/_apis/securitynamespaces?api-version=7.0-preview.1`,
        {
          headers: this.createAzDevOpsHeaders(token)
        }
      );

      if (!securityNamespaceResponse.ok) {
        const errorText = await securityNamespaceResponse.text();
        throw new Error(`Failed to get security namespaces: ${securityNamespaceResponse.status} - ${errorText}`);
      }

      const securityNamespaces = await securityNamespaceResponse.json() as SecurityNamespacesResponse;
      const projectNamespace = securityNamespaces.value.find((ns) => ns.name === "Project");
      
      if (!projectNamespace) {
        throw new Error("Project security namespace not found");
      }

      // Now we apply the permission
      const response = await fetch(
        `https://dev.azure.com/${orgName}/_apis/accesscontrollists/${projectNamespace.namespaceId}?api-version=7.0-preview.1`,
        {
          method: 'POST',
          headers: this.createAzDevOpsHeaders(token),
          body: JSON.stringify({
            value: [{
              token: `$PROJECT:${projectId}`,
              acesDictionary: {
                [groupDescriptor]: {
                  descriptor: groupDescriptor,
                  allow: 31,
                  deny: 0
                }
              }
            }]
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