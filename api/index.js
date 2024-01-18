const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
const User = require('./models/User');
const Place = require('./models/Place');
const Booking = require('./models/Booking')
const cookieParser = require('cookie-parser');
const multer = require("multer")
const app = express();
const bcryptSalt = bcrypt/bcrypt.genSaltSync(10); 
const jwtSecret = 'fase7r85h8dnv93j4oviwhdiodudgidjgjw';
const download = require('image-downloader');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

app.use(express.json()); 
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

app.use(cors({
  credentials: true,
  origin: 'http://localhost:5173',
}));

app.get('/test', (req, res) => {
  res.json('test ok')
});

mongoose.connect(process.env.MONGO_URL)

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  })
}


/* *********REGISTER********** */
app.post('/register', async (req, res) => {
  const {name, email, password} = req.body
  try{
    const userDoc = await User.create({
        name, 
        email,
        password: bcrypt.hashSync(password, bcryptSalt),
      })
      res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

/* *********LOGIN********** */
app.post('/login', async (req, res) => {
  const {email, password} = req.body;
  const userDoc = await User.findOne({email})
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password)
    if(passOk) {
      jwt.sign({
        email:userDoc.email, 
        id:userDoc._id,
        name: userDoc.name
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json(userDoc)
      })
    } else { 
      res.status(422).json('pass not ok')
    }
  } else {
    res.json("not found")
  }
})

/* *******PROFILE*********** */
app.get("/profile", (req, res) => {
  const {token} = req.cookies;
  if(token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if(err) throw err;
      const {name, email, _id} = await User.findById(userData.id)
      res.json({name, email, _id});
    })
  } else {
    res.json(null)
  }
})

/* *******LOGOUt*********** */
app.post('/logout', (req, res) => {
  res.cookie('token', '').json(true)
})


/* *******ADD PLACE IMAGE BY LINK*********** */
app.post("/upload-by-link", async (req, res) => {
  const {link} = req.body
  const newName = "photo" + Date.now() + '.jpg';
  await download.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
  })
  res.json(newName);
});

/* *******UPLOAD PLACE IMAGE BY FILE*********** */
const photosMiddleware = multer({dest:'uploads'});
app.post("/upload", photosMiddleware.array('photos', 100),(req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    console.log(req.files[i]);
    const {path, originalname} = req.files[i];
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1]
    const newPath = path + '.' + ext
    fs.renameSync(path, newPath)
    uploadedFiles.push(newPath.replace('uploads\\', ''))
  }
  res.json(uploadedFiles)
});

/* *******ADD PLACE*********** */
app.post('/places', (req, res) => {
  const {token} = req.cookies;
  const {
    title, address, addedPhotos,
    description, perks, extraInfo,
    checkIn, checkOut, maxGuests, price
   } = req.body
  if(token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if(err) throw err;
      const placeDoc = await Place.create({
        owner: userData.id,
        title, address, photos:addedPhotos,
        description, perks, extraInfo,
        checkIn, checkOut, maxGuests, price
      });
      res.json(placeDoc)
    });
  }
});

/* *******DISPLAY PLACES*********** */
app.get('/user-places', (req, res) => {
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const {id} = userData;
    res.json(await Place.find({owner:id}));
  });
});


/* *******UPDATE PLACES*********** */
app.get("/places/:id", async (req, res) => {
  const {id} = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  const {token} = req.cookies;
  const {
    id, title, address, addedPhotos,
    description, perks, extraInfo,
    checkIn, checkOut, maxGuests, price
   } = req.body
   jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos:addedPhotos,
        description, perks, extraInfo,
        checkIn, checkOut, maxGuests, price
      });
      await placeDoc.save();
      res.json('ok')
    }
  });
});

/* *********INDEX PAGE*********** */
app.get('/places', async (req, res) => {
  res.json( await Place.find() )
});


/* *********BOOKINGS PAGE*********** */
app.post('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req)
  const {
    place, checkIn, checkOut,
     numberOfGuests, name, phone, price, 
    } = req.body;
    Booking.create({
      place, checkIn, checkOut,
      numberOfGuests, name, phone, price,
      user:userData.id 
    }).then((doc) => {
      res.json(doc);
    }).catch((err) => {
      throw err;
    });
});


app.get('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req)
  res.json( await Booking.find({user:userData.id}))
})
app.listen(4000);