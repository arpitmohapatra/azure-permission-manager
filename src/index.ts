import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AzureDevOpsService } from "./azure-devops-service.js";
import { PermissionPolicy, PermissionType } from "./types.js";

// Create the MCP server
const server = new McpServer({
  name: "Azure DevOps Permission Manager",
  version: "1.0.0",
  description: "MCP server for managing Azure DevOps permissions using Entra groups",
});

// Initialize Azure DevOps service
const azureDevOpsService = new AzureDevOpsService();

// Add tool to apply a permission policy
server.tool(
  "applyPermissionPolicy",
  {
    org_name: z.string().describe("The name of the Azure DevOps organization"),
    project_name: z.string().describe("The name of the Azure DevOps project"),
    entra_group_name: z.string().describe("The name of the Entra group to assign permissions to"),
    type_of_permission: z.enum([
      PermissionType.READER,
      PermissionType.CONTRIBUTOR,
      PermissionType.PROJECT_ADMIN,
      PermissionType.BUILD_ADMIN,
      PermissionType.RELEASE_ADMIN,
      PermissionType.CUSTOM
    ]).describe("The type of permission to apply")
  },
  async ({ org_name, project_name, entra_group_name, type_of_permission }) => {
    try {
      const policy: PermissionPolicy = {
        org_name,
        project_name,
        entra_group_name,
        type_of_permission: type_of_permission as PermissionType,
      };

      const result = await azureDevOpsService.applyPermissionPolicy(policy);

      return {
        content: [
          {
            type: "text",
            text: result.message
          }
        ]
      };
    } catch (error) {
      console.error("Error applying permission policy:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error applying permission policy: ${(error as Error).message}`
          }
        ]
      };
    }
  }
);

// Add tool to list projects in an organization
server.tool(
  "listProjects",
  {
    org_name: z.string().describe("The name of the Azure DevOps organization")
  },
  async ({ org_name }) => {
    try {
      const projects = await azureDevOpsService.listProjects(org_name);
      
      const projectList = projects.map(p => `- ${p.name} (${p.id})`).join('\n');
      
      return {
        content: [
          {
            type: "text",
            text: projects.length > 0 
              ? `Projects in organization ${org_name}:\n\n${projectList}` 
              : `No projects found in organization ${org_name}`
          }
        ]
      };
    } catch (error) {
      console.error("Error listing projects:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error listing projects: ${(error as Error).message}`
          }
        ]
      };
    }
  }
);

// Add tool to lookup an Entra group
server.tool(
  "lookupEntraGroup",
  {
    group_name: z.string().describe("The name of the Entra group to lookup")
  },
  async ({ group_name }) => {
    try {
      const group = await azureDevOpsService.getEntraGroupByName(group_name);
      
      if (!group) {
        return {
          content: [
            {
              type: "text",
              text: `No Entra group found with name: ${group_name}`
            }
          ]
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Entra group found:\n\nName: ${group.displayName}\nID: ${group.id}\nDescription: ${group.description || 'None'}`
          }
        ]
      };
    } catch (error) {
      console.error("Error looking up Entra group:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error looking up Entra group: ${(error as Error).message}`
          }
        ]
      };
    }
  }
);

// Add tool to bulk apply permissions from a JSON policy file
server.tool(
  "bulkApplyPermissions",
  {
    policies: z.array(z.object({
      org_name: z.string(),
      project_name: z.string(),
      entra_group_name: z.string(),
      type_of_permission: z.enum([
        PermissionType.READER,
        PermissionType.CONTRIBUTOR,
        PermissionType.PROJECT_ADMIN,
        PermissionType.BUILD_ADMIN,
        PermissionType.RELEASE_ADMIN,
        PermissionType.CUSTOM
      ])
    })).describe("Array of permission policies to apply")
  },
  async ({ policies }) => {
    try {
      const results = [];
      
      for (const policy of policies) {
        const result = await azureDevOpsService.applyPermissionPolicy(policy as PermissionPolicy);
        results.push({
          policy,
          result
        });
      }
      
      const successCount = results.filter(r => r.result.success).length;
      const failureCount = results.length - successCount;
      
      let responseText = `Applied ${successCount} permissions successfully, ${failureCount} failed.\n\nDetails:\n\n`;
      
      for (const result of results) {
        responseText += `- ${result.policy.org_name}/${result.policy.project_name}/${result.policy.entra_group_name}: ${result.result.success ? '✅' : '❌'} ${result.result.message}\n`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };
    } catch (error) {
      console.error("Error in bulk apply permissions:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error in bulk apply permissions: ${(error as Error).message}`
          }
        ]
      };
    }
  }
);

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  
  try {
    console.error("Starting Azure DevOps Permission Manager MCP server...");
    await server.connect(transport);
    console.error("Server connected successfully");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
