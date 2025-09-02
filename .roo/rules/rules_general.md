# GENERAL
- local: http://192.168.1.60:1235
- backend api url https://api.claritybusinesssolutions.ca/ 
- see /doc for openapi endpoints
- see /openapi.json for json version of the api endpoints
- production backend can be accessed via ssh marcus@backend.claritybusinesssolutions.ca. Project is at /opt/clarity-backend/ and is dockerized
- docker files and config is in /opt/clarity-backend/docker
- use full paths in your termianl commands
- Do not create new files that abondon existing file. Edit the existing file to work
- files should only be created for repeatable, reusable code. Temporary, situation based testing/evaluation should use terminal commands.
- assume the server is running unless there is evidence to the contrary
- you may not create test files when:
  - a test file already exists that closely resembles our needs (reuse before create)
  - a test file exists and can be extended to test what is needed
  - test can be verified using cURL
- NEVER conclude as successful without testing your assumptions and establishing the conclusions in fact

- when providing other developes direction on this current project:
    - assume competance
    - they have established patterns. Do not provide patterns unless explicitely asked.

- When you want to use Browser, instead verify api calls using cURL or ask user to test Ui and report

### Context Awareness
- **roo.md** if a file is in a directory and that directory also has a roo.md file in it, the roo.md file contains important context specific to that directory and should be read prior to interacting with files in the directory