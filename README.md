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
  - Managed Identity with permissions to read Entra groups and manage Azure DevOps permissions

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/azure-devops-permission-manager.git
cd azure-devops-permission-manager

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Authentication

This server uses Azure's DefaultAzureCredential which supports several authentication methods:

1. Environment variables
2. Managed Identity
3. Azure CLI
4. Visual Studio Code
5. Interactive browser login

For production use, it's recommended to use Federated Managed Identity.

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

## License

MIT 