import requests
import os
from dotenv import load_dotenv

def test_azure_devops_api():
    # Load environment variables
    load_dotenv()
    
    # Azure DevOps organization name
    org_name = "aalcloud"
    
    # Get Personal Access Token from environment variable
    pat = os.getenv('AZURE_DEVOPS_PAT')
    if not pat:
        print("Error: AZURE_DEVOPS_PAT environment variable not found")
        return
    
    # Create Basic Auth header with PAT
    auth = ('', pat)  # Username can be empty when using PAT
    
    # API versions to try
    api_versions = ['7.0']
    
    for version in api_versions:
        print(f"\nTrying API version: {version}")
        
        # Azure DevOps REST API URL for listing projects
        url = f"https://dev.azure.com/{org_name}/_apis/projects?api-version={version}"
        
        try:
            # Make the request
            response = requests.get(url, auth=auth)
            
            # Print response status and headers for debugging
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.ok:
                # If successful, print the projects
                data = response.json()
                print("\nProjects found:")
                for project in data.get('value', []):
                    print(f"- {project['name']} (ID: {project['id']})")
                return
            else:
                print(f"Error Response: {response.text}")
                
        except Exception as e:
            print(f"Error making request: {str(e)}")
    
    print("\nFailed to list projects with all API versions tried")

if __name__ == "__main__":
    test_azure_devops_api() 