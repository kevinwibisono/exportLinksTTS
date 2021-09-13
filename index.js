const express = require('express');
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

const admin = require("firebase-admin");
const serviceAccount = require("./uploads/pawfriends-a5086-firebase-adminsdk-gc5n3-32010c9fc4.json");
const { response } = require('express');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "pawfriends-a5086.appspot.com"
});

const firebaseStorageBucket = admin.storage().bucket();

const mailjet = require('node-mailjet').connect(
    "e70895b637b61e7456a5579991b5ec4d",
    "8ca3e8366e1b2965a847f47867829241"
)

const artikel = require("./routes/artikel");
const penarikan = require("./routes/penarikan");
const app = express();
app.use(express.json());
app.use(express.static("./uploads"));
app.use(express.urlencoded({extended:true}));
app.set("view engine", "ejs");




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
    res.render("login", {error: null});
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

                var pjDoc = await firestore.collection("pesanan_janjitemu").doc(id_pj).get();
                var pesananjanjitemu = pjDoc._delegate._document.data.value.mapValue.fields;
                let messageBuyer = {
                    notification: {
                        title: "Pembayaran Telah Terverifikasi",
                        body: "Pesananmu Telah Diteruskan Ke Penjual"
                    },
                    topic: pesananjanjitemu.hp_pembeli.stringValue
                }

                let messageSeller = {
                    notification: {
                        title: "Ada Pesanan Baru",
                        body: "kamu Mendapat Pesanan Baru"
                    },
                    topic: pesananjanjitemu.hp_penjual.stringValue
                }
            
                admin.messaging().send(messageBuyer);
                
                admin.messaging().send(messageSeller);


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
        notification: {
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

app.get("/dashboard", async function(req, res){
    var kategoriList = ["Informasi", "Tips & Trik", "Acara", "Komunitas", "Peristiwa", "Cerita Pemilik"];
    var readerList = ["Semua Pemilik", "Pemilik Baru", "Pemilik Berpengalaman"];
    var artikelDBList = await firestore.collection("artikel").orderBy("tanggal", "desc").limit(10).get();
    var artikelList = [];
    artikelDBList.forEach(artikelDB => {
        var artikel = artikelDB._delegate._document.data.value.mapValue.fields;
        var newArtikel = {};
        newArtikel["kategori"] = kategoriList[artikel.kategori.integerValue];
        newArtikel["reader"] = readerList[artikel.target_pembaca.integerValue];
        newArtikel["link"] = artikel.link.stringValue;
        newArtikel["like"] = artikel.like.integerValue;
        newArtikel["judul"] = artikel.judul.stringValue;
        newArtikel["tanggal"] = new Date(parseInt(artikel.tanggal.timestampValue.seconds) * 1000).toISOString().substr(0,10)
        artikelList.push(newArtikel);
    });

    var bankList = ["Artha Graha Internasional", "Bank Central Asia", "Bank Negara Indonesia", "CIMB Niaga", "Mandiri"];
    var saldoTarikDBList = await firestore.collection("riwayat_saldo").where("jenis", "==", 2).where("bukti_transfer", "==", "").orderBy("tanggal", "asc").limit(10).get();
    var saldoTarikList = [];
    saldoTarikDBList.forEach(async (saldoTarikDB) => {
        var penarikan = saldoTarikDB._delegate._document.data.value.mapValue.fields;
        var newPenarikan = {};
        newPenarikan["nama"] = penarikan.nama.stringValue;
        newPenarikan["jenis_rek"] = bankList[penarikan.jenis.integerValue];
        newPenarikan["tanggal"] = new Date(parseInt(penarikan.tanggal.timestampValue.seconds) * 1000).toISOString().substr(0,10);
        saldoTarikList.push(newPenarikan);
    });

    res.render("home", {artikelList: artikelList, saldoTarikList: saldoTarikList});
});

app.get("/trialFindSeller", async function(req, res){
    var sellerDB = await firestore.collection("detail_penjual").doc(req.query.no_hp).get();
    if(sellerDB._delegate._document != null){
        res.send(sellerDB._delegate._document.data.value.mapValue.fields);
    }
    else{
        res.send("no seller found");
    }
})

app.post("/adminLogin", async function(req, res){
    let username = req.body.username;
    let pass = req.body.password;
    if(username == "admin" && pass == "admin"){
        res.redirect("https://pawfriends-admin.herokuapp.com/dashboard");
    }
    else{
        res.render("login", {error: "Username/Password Tidak Valid"});
    }
});

app.use("/route/artikel", artikel);
app.use("/route/penarikan", penarikan);

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
