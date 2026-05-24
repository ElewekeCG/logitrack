# Internship Journal — LogiTrack CI/CD Pipeline Project

---

## Project Overview

My task was to implement a full CI/CD pipeline for **LogiTrack**, a microservices-based logistics tracking application consisting of three services: a Merchant Service, a Rider Service, and a Tracking Service, each backed by a shared PostgreSQL database.

The goal of the project was to automate the entire software delivery lifecycle — from running tests and building Docker images, to deploying each service to an AWS EC2 instance in a controlled, sequential manner with health verification at each stage.

The pipeline was built using **GitHub Actions** and followed a structured workflow:

1. Run tests for all three services in parallel
2. Build and push Docker images to Docker Hub
3. Provision the database and copy deployment scripts to the server
4. Deploy each service sequentially, verifying health before proceeding to the next
5. Automatically roll back any service that fails its health check

---

## Tools and Technologies Used

| Tool / Technology | Purpose |
|---|---|
| **GitHub Actions** | CI/CD pipeline orchestration |
| **Docker** | Containerisation of all services and the database |
| **Docker Hub** | Container image registry |
| **AWS EC2** | Cloud hosting for all deployed services |
| **PostgreSQL** | Relational database shared across services |
| **Node.js / npm** | Runtime and package manager for all three services |
| **appleboy/ssh-action** | Remote SSH execution on the EC2 instance |
| **appleboy/scp-action** | Secure file transfer of deployment scripts to the server |
| **Bash scripting** | Health check and rollback automation |

---

## Challenges Faced

### 1. YAML Indentation and Syntax Errors
I struggled alot with writing the GitHub Actions file. I encountered issues such as incorrect indentation, missing leading slashes in file paths, and trailing spaces after line-continuation backslashes. These errors were difficult to trace but after much debugging I was able to find them.

**Example:** A trailing space after a `\` in a `docker run` command caused Docker to interpret `--restart` as an image name, producing the error `Unable to find image 'restart:latest' locally`. Resolving this required placing the entire `docker run` command on a single line to eliminate all backslashes.

### 2. Secrets and Environment Variable Management
Passing secrets safely to remote servers via SSH caused an error as well. GitHub Actions secrets cannot be directly used as shell variables on remote machines — attempting to expand `${{ secrets.DATABASE_URL }}` inline inside an SSH script block caused the variable to be empty or malformed on the server. The solution was to use the `envs` parameter provided by `appleboy/ssh-action` to forward variables to the remote environment explicitly.

### 3. Docker Networking Between Containers
Configuring the services to communicate with the PostgreSQL database and with each other required setting up a shared Docker network. Initially, services were attempting to connect to `127.0.0.1:5432` inside their containers rather than reaching the database container by name. This was resolved by creating a dedicated Docker network (`logitrack-network`) and attaching all containers to it, allowing them to resolve each other by container name.

### 4. File Path Issues with SCP
Copying deployment scripts to the EC2 server using `appleboy/scp-action` produced a nested directory structure (`~/scripts/scripts/`) because the target directory already existed on the server. This caused rollback scripts to fail with `No such file or directory`. The fix required deleting the existing directory on the server and correcting the target path to use an absolute path with a leading `/`.

### 5. Rollback Implementation
Implementing a reliable rollback mechanism required careful sequencing — the previous running image had to be captured before the new container replaced it. An initial approach using a `tag_stable.sh` script to retag images on Docker Hub proved unreliable on first deployments where no prior container existed. This was replaced with a simpler approach that saved the current container's image reference to a `/tmp` file before each deploy, which the rollback script could then read and redeploy.

### 6. Health Check Gate Failures
The health check job was stuck returning HTTP `000` for an extended period. Debugging revealed multiple contributing factors: the application was not receiving a valid `DATABASE_URL` environment variable, causing it to crash on startup and enter a restart loop. Additionally, the relevant ports were not open in the EC2 security group, preventing external HTTP requests from reaching the services.

---

## Lessons Learned

### 1. Debug Incrementally
Attempting to build and run the entire pipeline end-to-end from the start made it difficult to isolate failures. A more effective approach was to validate each job in isolation — confirming SSH connectivity, script availability, and container health before wiring jobs together in the full pipeline.

### 2. Explicit is Better Than Implicit
Several issues arose from assumptions — assuming a directory existed on the server, assuming a secret would be available as a shell variable, or assuming a container name matched what the script expected. Explicitly verifying paths, variable values, and container states at each step would have caught these issues earlier.

### 3. Trailing Whitespace is a Silent Killer
In Bash, a space after a line-continuation backslash breaks the command silently in ways that produce very misleading error messages. Adopting the practice of writing long `docker run` commands on a single line — or carefully validating each continuation — would prevent this class of error entirely.

### 4. Secrets Management Requires Careful Design
Handling credentials securely across a CI/CD pipeline is non-trivial. Inline secret expansion inside SSH scripts can lead to empty values or injection issues. Using the `envs` forwarding mechanism and storing credentials as GitHub Actions secrets rather than in code or `.env` files is the correct pattern and should be established at the start of a project.

### 5. Container Networking Must Be Planned Upfront
Docker's default networking behaviour — where containers cannot communicate by name — caused significant debugging time. Planning the network topology before writing any deployment code, and establishing a shared network as part of the setup phase, would have prevented the database connectivity issues encountered during deployment.

### 6. Rollback Logic Should Be Simple and Reliable
Complex rollback mechanisms are likely to fail at the worst possible time. The simplest reliable approach — saving the previous image reference to a file before each deploy and reading it back during rollback — proved more dependable than maintaining separate stable tags on Docker Hub.

---

## Conclusion

I gained hands-on experience with real-world DevOps practices through this project. despite running into numerous errors, I managed to fix them and solidify my understanding of several concepts.