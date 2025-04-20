# Azure DevOps Permission Manager MCP Server

An [MCP](https://modelcontextprotocol.io/) server for managing Azure DevOps permissions using Microsoft Entra ID (formerly Azure AD) groups. This server allows you to easily provision policy-based access control for Azure DevOps organizations and projects.

## Features

- Apply permissions to Azure DevOps projects using Entra groups
- List projects in an Azure DevOps organization
- Look up Entra groups by name
- Bulk apply permissions from a JSON policy file

## Prerequisites

- Node.js 18 or higher
- Azure account with:
  - Azure DevOps organization
  - Microsoft Entra ID groups
  - Azure AD Application with Graph API permissions

## Environment Variables

### Required for Azure DevOps Operations
- `AZURE_DEVOPS_PAT`: Personal Access Token for Azure DevOps operations

### Required for Entra (Azure AD) Operations
- `AZURE_CLIENT_ID`: Application (client) ID from Azure AD App Registration
- `AZURE_CLIENT_SECRET`: Client secret from Azure AD App Registration
- `AZURE_TENANT_ID`: Azure AD tenant ID

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/azure-devops-permission-manager.git
cd azure-devops-permission-manager

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Set up environment variables
export AZURE_DEVOPS_PAT="your-pat-token"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
export AZURE_TENANT_ID="your-tenant-id"
```

## Authentication

The server uses two different authentication methods:

1. Azure DevOps: Personal Access Token (PAT)
   - Generate a PAT from Azure DevOps portal
   - Set it in AZURE_DEVOPS_PAT environment variable

2. Entra ID (Azure AD): Client Credentials
   - Create an App Registration in Azure AD
   - Grant it "Group.Read.All" Microsoft Graph API permission
   - Create a client secret
   - Set the client ID, secret, and tenant ID in environment variables

## Usage

Run the server:

```bash
npm start
```

Or with npx:

```bash
npx azure-devops-permission-manager
```

### Tools

#### Apply Permission Policy

Applies a permission policy to a project for an Entra group.

```json
{
  "org_name": "your-azure-devops-org",
  "project_name": "your-project",
  "entra_group_name": "Your Entra Group Name",
  "type_of_permission": "contributor"
}
```

Permission types:
- `reader`
- `contributor`
- `projectAdmin`
- `buildAdmin`
- `releaseAdmin`
- `custom`

#### List Projects

Lists all projects in an Azure DevOps organization.

```json
{
  "org_name": "your-azure-devops-org"
}
```

#### Lookup Entra Group

Looks up an Entra group by name.

```json
{
  "group_name": "Your Entra Group Name"
}
```

#### Bulk Apply Permissions

Applies multiple permission policies in one call.

```json
{
  "policies": [
    {
      "org_name": "your-azure-devops-org",
      "project_name": "project1",
      "entra_group_name": "Developers Group",
      "type_of_permission": "contributor"
    },
    {
      "org_name": "your-azure-devops-org",
      "project_name": "project2",
      "entra_group_name": "Admins Group",
      "type_of_permission": "projectAdmin"
    }
  ]
}
```

## Example Policy JSON

```json
{
  "policies": [
    {
      "org_name": "contoso",
      "project_name": "Marketing",
      "entra_group_name": "Marketing Team",
      "type_of_permission": "contributor"
    },
    {
      "org_name": "contoso",
      "project_name": "Finance",
      "entra_group_name": "Finance Admins",
      "type_of_permission": "projectAdmin"
    },
    {
      "org_name": "contoso",
      "project_name": "Finance",
      "entra_group_name": "Finance Viewers",
      "type_of_permission": "reader"
    }
  ]
}
```

## Federated Managed Identity Setup

To use federated managed identity:

1. Create a User-Assigned Managed Identity in Azure
2. Assign the required permissions:
   - Microsoft Graph API: `Group.Read.All`
   - Azure DevOps: Administrator permissions
3. Configure federation with your deployment platform
4. Set environment variables in your deployment:
   - `AZURE_CLIENT_ID`: The client ID of your managed identity
   - `AZURE_TENANT_ID`: Your Azure tenant ID

## MCP Configuration

To use this server with MCP, add the following configuration to your MCP client:

```json
{
  "name": "Azure DevOps Permission Manager",
  "version": "1.0.0",
  "description": "MCP server for managing Azure DevOps permissions using Entra groups",
  "tools": {
    "applyPermissionPolicy": {
      "description": "Apply a permission policy to a project for an Entra group",
      "parameters": {
        "org_name": "string",
        "project_name": "string",
        "entra_group_name": "string",
        "type_of_permission": "enum(reader,contributor,projectAdmin,buildAdmin,releaseAdmin,custom)"
      }
    },
    "listProjects": {
      "description": "List all projects in an Azure DevOps organization",
      "parameters": {
        "org_name": "string"
      }
    },
    "lookupEntraGroup": {
      "description": "Look up an Entra group by name",
      "parameters": {
        "group_name": "string"
      }
    },
    "bulkApplyPermissions": {
      "description": "Apply multiple permission policies in one call",
      "parameters": {
        "policies": "array"
      }
    }
  }
}
```

### Example MCP Tool Calls

#### Apply Single Permission
```typescript
await mcp.call("applyPermissionPolicy", {
  org_name: "aalcloud",
  project_name: "mcptest",
  entra_group_name: "mcptest",
  type_of_permission: "contributor"
});
```

#### List Projects
```typescript
const projects = await mcp.call("listProjects", {
  org_name: "aalcloud"
});
```

#### Lookup Entra Group
```typescript
const group = await mcp.call("lookupEntraGroup", {
  group_name: "mcptest"
});
```

#### Bulk Apply Permissions
```typescript
await mcp.call("bulkApplyPermissions", {
  policies: [
    {
      org_name: "aalcloud",
      project_name: "mcptest",
      entra_group_name: "mcptest",
      type_of_permission: "reader"
    },
    {
      org_name: "aalcloud",
      project_name: "mcptest",
      entra_group_name: "mcptest",
      type_of_permission: "buildAdmin"
    }
  ]
});
```

### Common Permission Scenarios

1. **Development Team Setup**
```typescript
await mcp.call("bulkApplyPermissions", {
  policies: [
    {
      org_name: "aalcloud",
      project_name: "project1",
      entra_group_name: "Developers",
      type_of_permission: "contributor"
    },
    {
      org_name: "aalcloud",
      project_name: "project1",
      entra_group_name: "DevOps",
      type_of_permission: "buildAdmin"
    },
    {
      org_name: "aalcloud",
      project_name: "project1",
      entra_group_name: "ReleaseManagers",
      type_of_permission: "releaseAdmin"
    }
  ]
});
```

2. **Project Management Setup**
```typescript
await mcp.call("bulkApplyPermissions", {
  policies: [
    {
      org_name: "aalcloud",
      project_name: "project1",
      entra_group_name: "ProjectManagers",
      type_of_permission: "projectAdmin"
    },
    {
      org_name: "aalcloud",
      project_name: "project1",
      entra_group_name: "Stakeholders",
      type_of_permission: "reader"
    }
  ]
});
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify your PAT token has the required scopes
   - Check if your Azure AD app has the necessary Graph API permissions
   - Ensure all environment variables are set correctly

2. **Permission Application Failures**
   - Verify the Entra group exists using the `lookupEntraGroup` tool
   - Check if the project exists using the `listProjects` tool
   - Ensure the PAT token has sufficient permissions

3. **Bulk Operation Issues**
   - Validate the JSON format of your policies
   - Check for typos in organization, project, or group names
   - Verify all referenced groups and projects exist

### Logging

The server provides detailed logging for troubleshooting:
- Authentication and token acquisition
- API requests and responses
- Permission application status

Enable debug logging by setting:
```bash
export DEBUG=azure-devops-permission-manager:*
```

## License

MIT 