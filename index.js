const express = require('express');
const fs = require('fs');
const multer = require('multer');
const nodeMailer = require('nodemailer');

const mailjet = require('node-mailjet').connect(
    "e70895b637b61e7456a5579991b5ec4d",
    "8ca3e8366e1b2965a847f47867829241"
)

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

app.post("/verifyEmail", function(req, res){
    const request = mailjet.post('send').request({
        FromEmail: 'pawfriendspartners@gmail.com',
        FromName: 'PawFriends',
        Subject: 'Verifikasikan Emailmu',
        'Text-part':
          'Hai PawFriends, berikut adalah kode verifikasi untuk emailmu',
        'Html-part':
          `<h2>Verifikasikan Emailmu</h2><br><br>Hai PawFriends, berikut adalah kode verifikasi untuk emailmu<br><br><h2>${req.query.code}</h2>`,
        Recipients: [{ Email: req.query.email }],
      })
      request
        .then(result => {
          console.log(result.body)
        })
        .catch(err => {
          console.log(err.statusCode)
        })
});

app.listen(process.env.PORT, function(){
    console.log(`listening port ${process.env.PORT}...`);
});
