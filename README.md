running instruction:
Download all libraries required on app.js file, npm init -y, npm run dev
should run on http://localhost:3500/
description of code:
First of all, the front end design is just a mean to get the input in to code different HTTP requests.

File upload: when uploading a file, the file is then saved to database storage, its metadata and download url is then saved in firestore as a collection to get a unique id
using that id, a mongo db collection is created and all sentences in that PDF file are stored in it.
Auth: I know saving the username and password on the html file is bad practice but i just want to send it to the backend. I used a simple middleware to deal with authentication

routes: I was trying to clean up all http requests to have each route on a seperate file to clean up the code. However, a random error kept occuring while and i couldn't fix it on time
to have the cleaner code ready.
Forgot to push to gitHub when starting thats why there is only one commit

