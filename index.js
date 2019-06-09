//Urvi Awasthi; Lending Library; May 13th, 2019
	//backend for mongodb and nodejs, making the books database from a json file, and then rendering that JSON file onto an HTML template

//requiring dotenv for environmental variables 
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
} 

//requiring mongo and all of the other required variables 
var bodyParser = require('body-parser');
var mongo = require('mongodb');
var express = require('express');
var app = express();
var fs = require('fs');
var paypal = require('paypal-rest-sdk');  
var readline = require ('readline'); 
app.use(bodyParser.urlencoded({ extended: true }));

//setting up environmental variables 
const PORT = process.env.PORT || 8082;

// setting up the ejs template engine
app.set('view engine', 'ejs');

//prerequisites
var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGODB_URI;

//for the css
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/views'));

//create the database and put the JSON data into the database
//reading the json file
var rawdata = fs.readFileSync('./views/books.json', 'utf8'); 
var jsonData = JSON.parse(rawdata);

var dbo;
//creating a database, dbo, and connecting to that database
MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  dbo = db.db("QuarterProjectDatabase");
  //creating a collection where the book data will be stored
  dbo.createCollection("books", function(err, res) {
  });
    //inserting data in books collection 
  dbo.collection("books").createIndex( {bookName: 1}, {unique: true}, function(err, res) {
          
    if (err){
      console.log("Cannot insert duplicates, document already exists");
    }
    else {
      dbo.collection('books').insertMany(jsonData, function(err, res){
      if (err) {
        console.log("Cannot insert duplicates, document already exists");
        return;
      };
      console.log(res.insertedCount+ " documents inserted");
      });
    }
  });
   
  dbo.createCollection("cart", function(err, res) {
  });

  dbo.collection("cart").createIndex( {bookName: 1}, {unique: true}, function(err, res){
    if (err) throw err;
  });

});

app.post("/clicked", function(req, res) {
  dbo.collection('cart').insertOne(req.body, (err, result) =>{
	  console.log(req.body);
    res.redirect('back');
  });
});

app.get("/", function (req, res) {
	res.render("index");
});

//puts the books from the JSON file into the webpage 
app.get("/purchase", function(req, res) {
	MongoClient.connect(url, function(err1, db) {
	  if (err1) throw err1;
	  var dbo = db.db("QuarterProjectDatabase");
	  dbo.collection("books").find({}).toArray(function(err2, result1) {
      if (err2) throw err2;	
      dbo.collection("cart").count(function(err3, result2) {
        if (err3) throw err3;	
        dbo.collection("cart").find({}).toArray(function(err4, result3) {
          if (err4) throw err4;	
          res.render('purchase', {
            result1: result1,
            result2: result2,
            result3: result3
          });
        });
      });
    });
  });
});

//loads the donate book page when someone clicks the link to that page
app.get("/donate", function (req, res) {
	res.render('donate.ejs');
});

//loads the about page when someone clicks the link to that page
app.get("/about", function (req, res) {
	res.render('about.ejs');
});

//loads the contactus book page when someone clicks the link to that page
app.get("/contactus", function (req, res) {
	res.render('contactus.ejs');
});

//adds a book to the book collection 
app.post('/donatebook', (req, res) => {
	const condition = req.body.condition;
	switch (condition)
	{
		case "Brand New":
			req.body.price = "15.00";
			break;
		case "Like New":
			req.body.price = "10.00";
			break;
		case "Very Good":
			req.body.price = "7.00";
			break; 
		case "Good":
			req.body.price = "6.00";
			break; 
		case "Acceptable":
			req.body.price = "5.00";
			break; 
	}	
    dbo.collection('books').insertOne(req.body, (err, result) =>{
      res.render("donate");
    });
});

//queries for a certain book in the database, depending on what the user wants
app.post('/query', (req, res) => {
	console.log(req.body);
	MongoClient.connect(url, function(err1, db) {
	  if (err1) throw err1;
	  var dbo = db.db("QuarterProjectDatabase");
	  dbo.collection("books").find(req.body).toArray(function(err, result1) {
		if (err) throw err;
		  dbo.collection("cart").count(function(err3, result2) {
			if (err3) throw err3;	
			dbo.collection("cart").find({}).toArray(function(err4, result3) {
			  if (err4) throw err4;	
			  res.render('purchase', {
				result1: result1,
				result2: result2,
				result3: result3
			  });
			});
		  });
	  });
	});
});

 
paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': process.env.CLIENT_ID ,
  'client_secret':process.env.CLIENT_SECRET
  });
  
//deletes the book page when someone clicks the book
app.get("/deleteABook", function (req, res) {
	dbo.collection('cart').deleteOne(req.body, (err, result) =>{
    });
});


app.post('/pay', function( req, res) {
	
//removes the books that the user has purchased from the database
dbo.collection("cart").find({}).toArray(function(err4, result3) {
	dbo.collection('books').deleteMany(result3, (err, result) =>{
		if (err) return console.log(err);
		console.log(result3);
	});
}); 
	
  var num = (Math.round(req.body.totalPrice * 100) / 100);
  req.body.totalPrice
	var create_payment_json = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": process.env.SUCCESS,
        "cancel_url": process.env.CANCEL
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "books4buy order",
                "sku": "ItemSku",
                "price": num.toString(),
                "currency": "USD",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "USD",
            "total": num.toString()
        },
        "description": "This is the payment description."
    }]
  };

  paypal.payment.create(create_payment_json, function (error, payment) {
    if (error) {
        throw error;
    } else {
        for (var i = 0; i < payment.links.length; i++){
          if (payment.links[i].rel == 'approval_url'){
            res.redirect(payment.links[i].href)
          }
        }
    }
  });

});

app.get('/success', (req, res) => {
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;


  const execute_payment_json = {
    "payer_id": payerId,
    /*"transactions": [{
       "amount": {
           "currency": "USD",
           "total": "10.00"
       }
    }]*/
  };

  paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
    if (error) {
        console.log(error.response);
        throw error;
    } else {

        dbo.collection('cart').deleteMany({});
        res.render('success', {
          first_name: payment.payer.payer_info.first_name,
          last_name: payment.payer.payer_info.last_name,
          line1: payment.payer.payer_info.shipping_address.line1,
          city: payment.payer.payer_info.shipping_address.city,
          state: payment.payer.payer_info.shipping_address.state,
          postal_code: payment.payer.payer_info.shipping_address.postal_code,
          country_code: payment.payer.payer_info.shipping_address.country_code,
          amount: payment.transactions[0].amount.total
        });
    }
});
});

app.listen(PORT);
console.log("App is listening at port " + PORT);
