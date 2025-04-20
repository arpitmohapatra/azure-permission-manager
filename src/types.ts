// Permission types
export interface PermissionPolicy {
  org_name: string;
  project_name: string;
  entra_group_name: string;
  type_of_permission: PermissionType;
}

export enum PermissionType {
  READER = "reader",
  CONTRIBUTOR = "contributor",
  PROJECT_ADMIN = "projectAdmin",
  BUILD_ADMIN = "buildAdmin",
  RELEASE_ADMIN = "releaseAdmin",
  CUSTOM = "custom"
}

// Azure DevOps API interfaces
export interface AzureDevOpsGroup {
  id: string;
  displayName: string;
  description?: string;
  origin: string;
  originId: string;
}

export interface EntraGroup {
  id: string;
  displayName: string;
  description?: string;
  members?: string[];
}

export interface ProjectReference {
  id: string;
  name: string;
  url: string;
}

export interface AzureDevOpsPermission {
  descriptor: string;
  displayName: string;
  roleName: string;
  token: string;
  identityId: string;
}

// Each permission type maps to a set of permissions in Azure DevOps
export const PermissionTypeMap: Record<PermissionType, string> = {
  [PermissionType.READER]: "Reader",
  [PermissionType.CONTRIBUTOR]: "Contributor",
  [PermissionType.PROJECT_ADMIN]: "Project Administrator",
  [PermissionType.BUILD_ADMIN]: "Build Administrator",
  [PermissionType.RELEASE_ADMIN]: "Release Administrator",
  [PermissionType.CUSTOM]: "Custom"
}; 