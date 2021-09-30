const express = require('express');
const multer = require('multer');

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




app.get("/", function(req, res){
    res.render("login", {error: null});
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
