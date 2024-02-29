const express = require("express");
const fileUpload = require("express-fileupload");
require('dotenv').config();
const path = require("path");
const os = require('os');
const filesPayloadExists = require('./middleware/filesPayloadExists');
const fileExtLimiter = require('./middleware/fileExtLimiter');
const fileSizeLimiter = require('./middleware/fileSizeLimiter');

const authorize = require('./middleware/authorize');

// importing middleware

// firebase part
// Import the functions you need from the SDKs you need

const { admin, storage, firestore } = require('./firebase');
const { ref: storageRef, uploadBytes,getDownloadURL,getBytes, getMetadata  } = require('firebase/storage');
const { collection, addDoc, getDoc, getDocs,doc } = require('firebase/firestore');

const console = require('console');
const fs = require('fs');
const {MongoClient} = require('mongodb');
const mongoUrl = process.env.MONGO_URL;
const client= new MongoClient(mongoUrl);
const pdfPoppler = require('pdf-poppler');
const bytes = require('bytes');





// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration


// Initialize Firebase

const pdfParse= require('pdf-parse');
const PORT = process.env.PORT || 3500;

const app = express();
// app.use(authorize);

app.use('/protected',authorize);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
    
}); 


/* 
    * Description: •	Upload a PDF file. The PDF file should be stored in an object storage, whether in the cloud or a locally running object storage. Also,
    store a record in your database indicating the name and time of upload for the given PDF. Parse the PDF for all the sentences. 
    These sentences should all be saved in a database.
    * @res returns status message whether upload was successful or not.
*/
app.post('/protected/upload',
    fileUpload({ createParentPath: true }),
    filesPayloadExists,
    fileExtLimiter(['.pdf']),
    fileSizeLimiter,
    async (req, res) => {
        const files = req.files
        console.log(files)
        try{
            const uploadPromises = Object.keys(files).map( async key => {
                const file = files[key];
                const filepath = path.join(__dirname, 'files', file.name);
            
            // move file locally
                await file.mv(filepath);
            // upload to firebase
                await uploadFile(file,filepath);
            });
        
        await promiseHooks.all(uploadPromises);
        return res.json({ status: 'success', message: 'Files uploaded successfully'});
        }  
        catch {
        return res.status(500).json({stauts:"error", message: console.error.message})
        }      
    
    }      
    );



// search using word
app.get('/protected/search',async(req,res) => {
    // grabbing the term entered by user
    try{
        

        const searchTerm= req.query.searchTerm;
        await client.connect();
        const db = client.db("sentenceStorage");
        // regex to match words case insensitive
        const regexPattern = new RegExp(searchTerm,'i');
    
        // list of all pdfs stored
        const collections= await db.listCollections().toArray();
        const searchResults = [];
        // iterate over each collection
        for (const collectionInfo of collections){
            const collectionName = collectionInfo.name;
            // regex insures case insensivity
            const cursor = db.collection(collectionName).find({sentence: { $regex:searchTerm, $options:'i'}});
            while (await cursor.hasNext()){     
                const doc = await cursor.next();

                searchResults.push({ pdfId: collectionName, sentence: doc.sentence});
            
            }
           
        }
        res.json({results: searchResults});

    
    } catch(error){
        console.error('Error searching in MongoDB', error);
        res.status(500).json({status: 'error', message:'Server error'});
    }
   
});

/*
    * Description: Given a PDF ID and page number return only the given page of the PDF, as an image. 
    * @res returns imgPath for client end to download or Returns error 404 for multiple different circumstances. 
*/
app.get('/protected/pdf-page/:id/:pageNumber',async (req,res)=> {
    const {id, pageNumber} = req.params;

    
      const pdfDocRef = doc(firestore,'rihalPdfs',id);
      const pdfDocSnap = await getDoc(pdfDocRef);
      // if pdf with that id doesn't exist
      if (!pdfDocSnap.exists()){
        res.status(404).send('PDF not found');
        return;
      }
      const pdfData = pdfDocSnap.data();
      const downloadURL = pdfData.url;
      
      // getting storage firebase url of file
      const response = await fetch(downloadURL);
      const arrayBuffer= await response.arrayBuffer();
      const buffer = await Buffer.from(arrayBuffer) ;

      const file_dir= path.join(__dirname,'files');
      // make the file if it doesnt exist already
      if (!fs.existsSync(file_dir)){
        fs.mkdir(file_dir, {recursive:true});
      }
      const tempPdfPath = path.join(file_dir, `${id}.pdf`);
     // const fileStream= fs.createWriteStream(tempPdfPath);
     fs.writeFileSync(tempPdfPath,buffer);

        let option = {
            format:'jpg',
            out_dir: file_dir,
            out_prefix: id,
            page:parseInt(pageNumber)
        };
      
        try{
            if (fs.existsSync(tempPdfPath)) {
                console.log('Converting PDF to image, file:', tempPdfPath);
              
                await pdfPoppler.convert(tempPdfPath, option); // converting page to img
                const outputImgPath = path.join(option.out_dir, `${id}-${pageNumber}.jpg`);
                const outputImgPathPadded = path.join(option.out_dir, `${id}-0${pageNumber}.jpg`);
                
                // for some reason pdfpoppler padded the page number with 0 if its a
                let finalImagePath = fs.existsSync(outputImgPath) ? outputImgPath : 
                fs.existsSync(outputImgPathPadded) ? outputImgPathPadded : 
                null;
                
                if (finalImagePath) {
                    res.sendFile(finalImagePath, (err) => {
                        if (err) console.error('Error sending file:', err);
                        fs.unlinkSync(finalImagePath); 
                    });
                } else {
                    console.error('Converted image not found:', finalImagePath);
                    res.status(404).send('Converted image not found');
                }
            
            } else {
                console.error('Temporary PDF file not found:', finalImagePath); // if path wasn't created
                res.status(404).send('PDF file not found');
            }
        } catch (error) {
            console.error('Error during PDF conversion:', error);
            res.status(500).send('Error converting PDF');
        } finally {
            fs.unlinkSync(tempPdfPath); // Clean up temp PDF
        }
    });

    app.get('/protected/get-files', async (req,res) => {
        try{
            const files= await getPdfFiles();
            // adding pdfs to table
            let filesHtml = '<table class="file-list">' + 
                            '<tr>' + 
                            '<th>File Name</th>' +
                            '<th>Size</th>' +
                            '<th>Uploaded by</th>' +
                            '<th>ID</th>' +
                            '<th>Action</th>' +
                            '<th> Top 5</th>' +
                            '</tr>';
                            files.forEach(file => {
                                filesHtml += `<tr>` +
                                `<td>${file.name}</td>` +
                                `<td>${file.size}</td>` +
                                `<td>${file.uploadTime}</td>` +
                                `<td>${file.id}</td>` +
                                `<td><button class="delete-Btn" data-doc-id="${file.id}" data-file-path="pdfs/${file.name}" >DELETE</button></td>` +
                                `<td><button class="top5-Btn" data-doc-id="${file.id}" data-file-path="pdfs/${file.name}" >Top 5</button></td>` +
                                `</tr>`;
                            });
    
                            filesHtml+='</table>';
                            res.send(filesHtml);
    
         } catch (error){
            console.error("Error fetching files: ", error);
            res.status(500).send('Error fetching files');
         }
    });

    app.use(express.json());
    /*
        * description: Delete a PDF file and all its related data (given only the PDF ID). 
        * @res 
    */
    app.post('/protected/delete-pdf',async (req,res) => {

    const firebaseAdmin = admin.firestore();
    const storage= admin.storage();
    // grabbing id from button
    const docId = req.body.docId;
    console.log(docId);
    try {
        await firebaseAdmin.collection('rihalPdfs').doc(docId).delete();
        
        console.log("Document successfully deleted from Firestore!");
        // deleting from firebase storage
        const fileRef = storage.bucket().file(req.body.filePath);
        
        await fileRef.delete();
        console.log("File successfully deleted from Firebase Storage!");

        await client.connect();
        const db= client.db("sentenceStorage");
        // deleting sentences from mongo db
        await db.collection(docId).drop();
        console.log(`MongoDB collection with ID ${docId} deleted`);
        res.status(200).send({message:'PDF deleted succesfully'});

    } catch(error){
        console.error("Error Deleting PDF: ", error);
        res.status(500).send({ error: 'Error deleting PDF' });

    }
  
 
});

/*
    * Description: Retrieve a stored PDF given the ID. 
    * @res redirects a firebase download url for client to download
*/
app.get('/get-pdf/:id', async(req,res) => {
    const {id} = req.params;

    try {
        const docRef= doc(firestore, 'rihalPdfs',id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).send('PDF not found');
        }
        const pdfData = docSnap.data();
        const downloadURL= pdfData.url;

        res.redirect(downloadURL);

    } catch(error){
        console.error('Error getting PDF:', error);
        res.status(500).send('Error retrieving PDF');
    }
});

// •	Return all the parsed sentences for a given PDF ID. 
app.get('/protected/get-sentences/:pdfId', async (req,res) => {
    const pdfId = req.params.pdfId;

    try {
        await client.connect();
        const db = client.db("sentenceStorage");
        const collection = db.collection(pdfId);

        const sentences = await collection.find({}).toArray();
        res.json(sentences.map(doc=>doc.sentence));
    }catch(error){
        console.error('Error retrieving sentences:', error);
        res.status(500).send('Error retrieving sentences');
    } finally {
        await client.close();
    }
    
});

// there is an array of numbers added at the end to avoid having numbers as top words. 
const stopWords = ['that', 'we','the', 'is', 'in', 'it', 'and', 'or', 'but', 'on', 'to', 'with','of','our','a',...Array.from({ length: 100 }, (_, i) => i.toString())]; 

/*
    * Description: •	Give the top 5 occurring words in a PDF – try to make sure that these words are relevant, 
    so filtering out stop words may be a good idea (e.g. the, it, and, is, or, but). DONE
    * @res returns array with the 5 words
*/
app.get('/protected/get-top-words/:firestoreId', async (req, res) => {
    const firestoreId = req.params.firestoreId;
    try{
        await client.connect();
        const db= client.db("sentenceStorage");
        const collection = db.collection(firestoreId);

        const sentences= await collection.find({}).toArray();
        // aggregate all sentences together
        const allText = sentences.map(doc => doc.sentence).join(" ");

        const words = allText.toLowerCase().match(/\b(\w+)\b/g);
        const wordCounts= words.reduce((acc,word) => {
            if (!stopWords.includes(word)) {
                acc[word] = (acc[word] || 0)+1;
            }
            return acc;
        },{}); 

        const topWords= Object.entries(wordCounts)
                                .sort((a,b) => b[1] - a[1])
                                .slice(0,5)
                                .map(entry => entry[0]);
        console.log("Top 5 words: ", topWords);
        res.json({topWords});
    } catch (error) {
        console.error('Error parsing PDF:', error);
        return [];
    } finally {
        await client.close();
    }
});

    // Check the occurrence of a word in PDF. Give the total number of times the word is found, in addition to all the sentences the word is found in
    app.get('/protected/search-word/:pdfId/:word', async (req, res) => {
        const pdfId = req.params.pdfId;
        const word = req.params.word.toLowerCase();
    
        try {
            await client.connect();
            const db = client.db("sentenceStorage");
            const collection = db.collection(pdfId);
            
            const sentences = await collection.find({}).toArray();
            let wordCount = 0;
            const sentencesWithWord = [];
            
            // looping around all sentences in mongo
            sentences.forEach(doc => {
                const sentence = doc.sentence;
                const sentenceLower = sentence.toLowerCase();
                const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
                
                if (sentenceLower.match(wordRegex)) {
                    sentencesWithWord.push(sentence);
                    wordCount += (sentenceLower.match(wordRegex) || []).length;
                }
            });
    
            res.json({ wordCount, sentencesWithWord });
        } catch (error) {
            console.error('Error searching word:', error);
            res.status(500).send('Error searching word');
        } finally {
            await client.close();
        }
    });


    

// fill the table listing all pdfs

async function getPdfFiles() {
    try{
        const filesSnapshot = await getDocs(collection(firestore, 'rihalPdfs'));
    

        const fileList = await Promise.all(filesSnapshot.docs.map(async (doc) => {
            const fileMetadata = doc.data();
            // getting the file's name
            fileRef = storageRef(storage,`pdfs/${fileMetadata.name}`);
            const metadata = await getMetadata(fileRef);
            
            return {
                id: doc.id, // Firestore document ID
                name: fileMetadata.name,
                size:  bytes(fileMetadata.size),
                numberOfPages: fileMetadata.numberOfPages, // assuming this is stored in Firestore
                uploadTime: metadata.timeCreated, // From Firebase Storage
                url: fileMetadata.url // Download URL from Firestore
            };
        }));
        return fileList;  
       
    } catch(error){
        console.error("Error fetching files: ", error);
        throw error;
    }
   
}

const parsePDF= async (filepath) => {
    try {
        const dataBuffer= fs.readFileSync(filepath);
        const data = await pdfParse(dataBuffer);

        const sentences = data.text.match(/([^.\n!?]+[.!?]+)|([^.\n!?]+\n)/g);
        return sentences || [];

    } catch (error) {
        console.error('Error parsing PDF:',error);
        return [];
    }
};
const saveInMongo =  async(sentences,file,id) => {
    try {
        await client.connect();
        const db= client.db("sentenceStorage");
       // const sentencesCollection = db.collection("sentences");
       const pdfCollection= db.collection(id);
        const insertPromises = sentences.map(sentence => {
            return pdfCollection.insertOne({
                pdfName: file.name,
                firebaseID: id,
                sentence:sentence.trim(),
                createdAt:new Date()
            });
        });
        await Promise.all(insertPromises);
        console.log('All sentences saved in MongoDB');

    } catch (error){
        console.error('Error interacting with MongoDB',error);
    } 

}


async function uploadFile(file,filepath){
    const fileRef= storageRef(storage,`pdfs/${file.name}`);
    const fileData = fs.readFileSync(filepath);

    try {
        const fileSnapshot = await uploadBytes(fileRef, fileData); 
        console.log('File uploaded:',fileSnapshot.metadata.fullPath);
    } catch(error){
        console.error('Error uploading file:', error);
        throw error;
    }

    
    const downloadURL = await getDownloadURL(fileRef);

    const docRef= await addDoc(collection(firestore, 'rihalPdfs'), {
        name:file.name,
        size: file.size,
        mimetype: file.mimetype || 'application/pdf', // providing a default value
        url: downloadURL

    });


    console.log('Metadata stored in Firestore with ID:', docRef.id);
    parsePDF(filepath).then(sentences => {
        console.log('Sentences extracted from the PDF:');
        sentences.forEach((sentence, index) => {
          console.log(`${index + 1}: ${sentence.trim()}`);
        });
        saveInMongo(sentences, file,docRef.id);
      });
      
   
    // remove file locally
    fs.unlinkSync(filepath);
}


    

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));