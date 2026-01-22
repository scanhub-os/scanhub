<p align="center">
    <img src="scanhub-ui/src/media/logo.png" width="100" alt="ScanHub">
    <h1 align="center">ScanHub</h3>
</p>

<p align="center">
<a href="https://github.com/brain-link/scanhub/actions/workflows/build.yml" target="_blank">
    <img src="https://github.com/brain-link/scanhub/actions/workflows/build.yml/badge.svg" alt="Build"/>
</a>
<a href="https://github.com/brain-link/scanhub/actions/workflows/static-tests-backend.yml" target="_blank">
    <img src="https://github.com/brain-link/scanhub/actions/workflows/static-tests-backend.yml/badge.svg" alt="Static Tests Backend"/>
</a>

<a href="https://scanhub.brain-link.de/" target="_blank">
    <img src="https://img.shields.io/badge/Documentation-online-brightgreen" alt="Documentation"/>
</a>
</p>



# About

ScanHub is intended to be a multi modal acquisition software, which allows individualizable, modular and cloud-based processing of functional and anatomical medical images. 
It seamlessly merges the acquisition with the processing of complex data on a single platform.
ScanHub is open-source and freely availably to anyone :earth_africa:.

The greatest novalty of ScanHub is the cross-manufacturer and multi-modality aspect, allowing accessible cloud-based data processing in one framework :rocket:

Currently we are focussing on the development of an acquisition solution for the open-source MRI [OSI2One](https://www.opensourceimaging.org/2023/01/09/first-open-source-mri-scanner-presented-the-osii-one/).

ScanHub is designed as a client-server application. It consists of several services that form the backbone of the acquisition platform and a web-based frontend called scanhub-ui. (The [scanhub-ui](https://github.com/brain-link/scanhub-ui) repository was incorporated into the subfolder scanhub-ui of this repository to facilitate the joint development).

We welcome anyone who would like to join our mission, just [get in touch](mailto:info@brain-link.de) :email:.


## Demo :clapper:

The following video shows a short demonstration of the ScanHub UI (September 2023). You will see how to navigate through the acquisition planner, inspect an MRI sequence and start an MRI simulation on a virtual MRI scanner. In the end we are demonstrating how to view the DICOM image, reconstructed by our workflow engine subsequently to the acquisition.

https://github.com/user-attachments/assets/da900b3b-e9b3-45bf-a6bb-85f69f3d5f73


## About

The advent of cloud computing has enabled a new era of innovation, and ScanHub is at the forefront of leveraging this technology for the benefit of the MRI community. By shifting image reconstruction, processing, and storage from on-site infrastructure to the cloud, ScanHub offers a myriad of advantages over traditional MRI consoles:
1.	Open-source transparency: ScanHub's open-source nature fosters transparency and collaboration within the MRI community, encouraging the development of a unified standard and preventing the fragmentation caused by proprietary black-box solutions. This approach enables researchers and developers to build upon each other's work, accelerating innovation and improving the overall quality of MRI solutions.
2.	Cost-efficiency: ScanHub eliminates the need for expensive on-site hardware and software, reducing both upfront investments and ongoing maintenance costs. This allows institutions of all sizes to access advanced MRI processing capabilities without breaking the budget.
3.	Scalability and flexibility: The cloud-based nature of ScanHub enables seamless scaling of resources as needed, allowing users to easily accommodate fluctuations in demand or expand their capabilities. Furthermore, ScanHub's platform-agnostic design allows for the integration of custom processing algorithms and third-party solutions, promoting innovation and avoiding vendor lock-in.
4.	Efficient resource utilization: ScanHub's centralized resource management ensures optimal allocation and utilization of resources across multiple projects and users, preventing bottlenecks and maximizing efficiency.
5.	Enhanced collaboration and data sharing: ScanHub's cloud-based infrastructure facilitates easy data sharing and collaboration among teams and institutions, enabling researchers to pool resources and insights to accelerate the development of new diagnostic techniques and treatments.
6.	Security and compliance: ScanHub's cloud platform adheres to stringent data security protocols and compliance requirements, ensuring that sensitive patient data remains protected and confidential.


## Installation + Start & Stop

Scanhub is deployed using Docker and Docker Compose. Make sure they are installed. There are some optional helper scripts like development-launcher.sh in this repository. If you use them, note that there are different versions of Docker Compose that are either called with "docker-compose" or "docker compose" and the helper scripts use the second form. If you want to install tools for development of Scanhub on Linux (Ubuntu/Mint), you may use the install-tools.sh script.

On the first installation of Scanhub, the Scanhub containers need to be built with Docker and Docker Compose. The containers also need to be built again after making certain changes during development, in particular after making changes to the base container, after installing libraries or when changing other structural aspects. When the containers are built, Scanhub can be started and stopped with Docker Compose.

### Building Scanhub:

Make sure that there is an internet connection, then apply the following steps:

    cd services/base
    docker build -t scanhub-base .
    cd ../..
    docker compose build --build-arg BASE_IMG=scanhub-base:latest

The Scanhub containers are built using a base image. The above commands create this base image from the latest state of the code on the local computer. To alternatively use a base image from ghcr.io/brain-link/scanhub/scanhub-base:latest, you may run only:

    docker compose build


### Starting Scanhub:

Run:

    docker compose up --detach

Open your browser and navigate to the default address "localhost". By default Scanhub uses a self-signed https certificate that will cause a security warning by the browser. You may ignore this warning for localhost during development. For production deployment see section "Deployment".


### Stopping Scanhub:

Run:

    docker compose down


### Starting Scanhub and tools for development

During development you may start scanhub and the tools for development using the development-launcher.sh script.
All scripts are located in the `tools/scripts/` folder.
It has an option --full-rebuild. For details, have a look in the script.

    tools/scripts/development-launcher.sh --full-rebuild


### Default Username and Password

If there is no user in the database, the software will display a form in the web-interface to create the first user. The password needs to have at least 12 characters.


### Deployment

Please mind the section about the "State of development".

Deployment was not testet yet! The following list gives an indication about some of the steps needed to deploy scanhub productively:

- Get a server (either on-site or in a datacenter/cloud)
- Get a domain name (e.g. scanhub.yourinstitution.com)
- Create a new private key (e.g. with openSSL). Keep this key private! Make sure not to commit it to the repository during development!
- Replace the default private key in secrets/privatekey.pem with your new private key
- Get a server certificate for your domain name (likely from the place where you got your domain name)
- Replace the default certificate in secrets/certificate.pem with your new certificate
- Change the default usernames and default passwords in all the configuration files in the folder secrets/
- In infrastructure/nginx_config.conf put your domain name as server_name in place of localhost (line 5 and line 21)
- In infrastructure/nginx_config.conf put your domain name in place of localhost as redirect target from http to https (line 8)
- In scanhub-ui/src/utils/Urls.tsx put your domain name in place of localhost
- In services/device-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- In services/exam-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- In services/mri/sequence-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- In services/patient-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- In services/user-login-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- In services/workflow-manager/app/main.py in the list of allowed origins, replace localhost with your domain name
- Build the Scanhub Containers as described in section "Installation + Start & Stop"
- Set up a service to automatically start Scanhub when booting the system
- Consider setting up monitoring of the servers resources etc.
- Consider limiting the number of connections, configure multiple workers/servers, load-balancing, etc.
- Consider removing the --reload option in the uvicorn commands in docker-compose.yml (6 occurances)
- Check for memory leaks when running the application over several days, consider automatic reboots
- Maybe put some development effort in the commented code in scanhub-ui/Dockerfile with the production flag


## Documentation

See our dedicated [Documentation](https://scanhub.brain-link.de/) web page to get insights into the structure of ScanHub, microservice APIs and more.


## State of development

This software is not yet ready for clinical use!


## Contributor Guide

We appreciate every contribution to ScanHub, if you would like to contribute to the project, please contact us.
Based on a stable main-branch, we are implementing features based on issues.

Feel free to open a new issues for any feature that you are missing in the current main branch.
Each issue should have a detailed description including a description of the problem, bug or feature and a potential solution approach.
We appreciate it if the issue is updated with the actual solution approach during development.
This documentation step might be helpful when working on similar or related issues.

When you start working on an issue, please create a new branch according to the following naming convention.

    Branch name: <ID>-short-name

The `<ID>` refers to the ID of the related issue and `short-name` is a short expression for the title of the issue.
Please link the branch to the issue, as soon as you start working on it.

