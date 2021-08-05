const express = require('express');
const fs = require('fs');
const multer = require('multer');

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

app.get("/", function(req, res){
    res.render("home");
});

app.post("/handlePayment", async function(req, res){
    var id_payment = req.query.id_payment;
    var str = "a|b";
    var strSplit = str.split("|");
    str = "";
    
    strSplit.forEach(strSplitEl => {
        str += strSplitEl+";";
    });

    //dapatkan document dari id_payment yang diberikan
    var paymentDoc = await firestore.collection("pembayaran").doc(id_payment).get();

    if(paymentDoc.exists){
        //jika ada pembayaran dengan id_payment tsb
        var payment = paymentDoc._delegate._document.data.value.mapValue.fields;
        var id_pjs = payment.id_pjs.stringValue.split("|");

        //temukan pesanan_janjitemu didalamnya dan update statusnya satu per satu
        id_pjs.forEach(id_pj => async function(){
            await firestore.collection("pesanan_janjitemu").doc(id_pj).set({
                status: 1
            }, {merge : true});
        });

        //setelah itu delete document pembayarannya
        await firestore.collection("pembayaran").doc(id_payment).delete();

        res.send("berhasil");
    }
    else{
        res.send("pembayaran tidak ditemukan");
    }
});

app.listen(3000, function(){
    console.log(`listening port ${process.env.PORT}...`);
});
