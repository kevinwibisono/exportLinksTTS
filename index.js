const express = require('express');
const fs = require('fs');
const multer = require('multer');
const nodeMailer = require('nodemailer');

const firebase = require("firebase");
const firebaseConfig = {
    apiKey: "AIzaSyA2GGpgQ1rGDdCFxnpYNoX6zzChPW5Pyok",
    authDomain: "pawfriends-a5086.firebaseapp.com",
    databaseURL: "https://pawfriends-a5086-default-rtdb.firebaseio.com",
    projectId: "pawfriends-a5086",
    storageBucket: "pawfriends-a5086.appspot.com",
    messagingSenderId: "416424761091",
    appId: "1:416424761091:web:67f9882d2f40bc19ad3b36",
    measurementId: "G-VT1H160HR0"
};
const firebaseInstance = firebase.initializeApp(firebaseConfig);
const firestore = firebaseInstance.firestore();

const admin = require("firebase-admin");
const serviceAccount = require("./uploads/pawfriends-a5086-firebase-adminsdk-gc5n3-32010c9fc4.json");
const { response } = require('express');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "pawfriends-a5086.appspot.com"
});

const firebaseStorageBucket = admin.storage().bucket();


const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("view engine", "ejs");
var images = [];
var objs = [];
var pdfs = [];
var decks = [];

function searchContents(obj){
    if(obj['CustomMesh']){
        var newObj = {
            "Name":obj['Nickname'],
            "MeshURL":obj['CustomMesh']['MeshURL']
        }
        objs.push(newObj);
    }
    if(obj['CustomImage']){
        var newImg = {
            "Name":obj['Nickname'],
            "Img":obj['CustomImage']['ImageURL']
        }
        if(obj['CustomImage']['ImageSecondaryURL']){
            newImg['Img2nd'] = obj['CustomImage']['ImageSecondaryURL'];
        }
        images.push(newImg)
    }
    if(obj['CustomDeck']){
        var newDeck = {
            "Name":obj['Nickname'],
            "Deck":JSON.stringify(obj['CustomDeck'])
        }
        decks.push(newDeck)
    }
    if(obj['CustomPDF']){
        var newPDF = {
            "Name":obj['Nickname'],
            "PDF":obj['CustomPDF']['PDFUrl']
        }
        pdfs.push(newPDF)
    }
}

const storage=multer.diskStorage({
    destination:'./uploads',
    filename:function(req,file,cb){
        filename = file.originalname;
        cb(null,file.originalname);
    }
});
const upload=multer({
    storage:storage
}).single('jsonfile');

app.post('/getLinksTTS', function(req, res){
    upload(req,res, async function (err){
        res.setHeader("Content-Type", "application/json");
        images = []; objs = []; decks = []; pdfs = [];
        var raw = fs.readFileSync('./uploads/'+req.file.originalname);
        var data = JSON.parse(raw);
        var objects = data['ObjectStates'];
        objects.forEach(obj =>{
            searchContents(obj);
            if(obj['ContainedObjects']){
                obj['ContainedObjects'].forEach(o => {
                    searchContents(o);
                    if(o['ContainedObjects']){
                        o['ContainedObjects'].forEach(oj => {
                            searchContents(oj);
                        });
                    }
                });
            }
        });
        res.json({"Images":images,"Objs":objs,"Decks":decks,"PDF":pdfs});
    });
    
});

app.post('/trialUpload', function(req, res){
    upload(req,res, async function (err){
        firebaseStorageBucket.upload('./uploads/'+req.file.originalname, (err, file) =>{
            if (err) { return console.error(err); }
            let publicUrl = `https://firebasestorage.googleapis.com/v0/b/pawfriends-a5086.appspot.com/o/${file.metadata.name}?alt=media`;
            console.log(publicUrl);
        });
    });
    
});

app.get("/", function(req, res){
    res.render("home");
});

app.post("/handlePayment", async function(req, res){
    var id_payment = req.query.id_payment;
    if(id_payment == undefined || id_payment == ""){
        res.send("pembayaran tidak ditemukan");
    }
    else{
        //dapatkan document dari id_payment yang diberikan
        var paymentDoc = await firestore.collection("pembayaran").doc(id_payment).get();

        if(paymentDoc.exists){
            //jika ada pembayaran dengan id_payment tsb
            var payment = paymentDoc._delegate._document.data.value.mapValue.fields;
            var id_pjs = payment.id_pjs.stringValue.split("|");

            //temukan pesanan_janjitemu didalamnya dan update statusnya satu per satu
            for (let index = 0; index < id_pjs.length; index++) {
                var id_pj = id_pjs[index];
                await firestore.collection("pesanan_janjitemu").doc(id_pj).set({
                    status: 1
                }, {merge : true});
                console.log(id_pj);
                if(index == id_pjs.length -1){
                    res.send("berhasil");
                }
            }

            //setelah itu delete document pembayarannya
            await firestore.collection("pembayaran").doc(id_payment).delete();

        }
        else{
            res.send("pembayaran tidak ditemukan");
        }
    }
});

app.get("/sendNotif", function(req, res){
    let message = {
        data: {
            title: req.query.judul,
            body: req.query.isi
        },
        topic: req.query.topik
    }

    admin.messaging().send(message)
    .then((response) => {
        // Response is a message ID string.
        res.json({"messageId":response,"error":""});
      })
      .catch((error) => {
        res.json({"messageId":"","error":error});
      });

      
});

app.listen(process.env.PORT, function(){
    console.log(`listening port ${process.env.PORT}...`);
});
