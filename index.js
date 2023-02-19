const express = require('express');

const cors = require('cors');

const app = express()

app.use(cors())

app.use(express.json())

require('dotenv').config()

var jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000

const stripe = require("stripe")(process.env.STRIPE_SK);

console.log(process.env.STRIPE_SK);

app.get('/', async (req, res) => {
    res.send('Server is running');
})

app.listen(port, () => {
    console.log("Server is running on port", port);
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7kbtzra.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split('')[1]

    jwt.sign(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        req.decoded = decoded
        next()
    });
}

async function run() {


    const categoriesCollection = client.db("phonesStore").collection("categories")
    const userCollection = client.db("phonesStore").collection("users")
    const productCollection = client.db("phonesStore").collection("products")
    const paidCollection = client.db("phonesStore").collection("paid")


    app.post('/jwt', async (req, res) => {
        const data = req.body;
        const token = jwt.sign(data, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
        res.send({ token })
    })

    app.get('/categories', async (req, res) => {
        const cursor = categoriesCollection.find({})
        const result = await cursor.toArray()
        res.send(result)
    })

    // users 
    app.post('/users', async (req, res) => {
        const data = req.body;
        const result = await userCollection.insertOne(data)
        res.send(result)
    })

    app.get('/users', async (req, res) => {
        const cursor = userCollection.find({})
        const result = await cursor.toArray()

        res.send({
            seller: result.filter(data => data?.role === 'Seller'),
            customer: result.filter(data => data?.role === 'Customer')
        })
    })

    app.get('/user', async (req, res) => {
        const query = req.query.email;

        console.log(query);
        const result = await userCollection.findOne({ email: query })
        if (result?.email === query) {
            res.send({ result: 1, role: result?.role, user: result })
        } else {
            res.send({ result: 0, role: null })
        }
    })


    // products 
    app.post('/products', verifyJWT, async (req, res) => {
        const data = req.body;
        const result = await productCollection.insertOne(data)
        res.send(result)
    })

    app.get('/products', async (req, res) => {
        const query = productCollection.find({})
        const allProducts = await query.toArray()

        const android = allProducts.filter(product => product.category === 'Android')
        const iphone = allProducts.filter(product => product.category === 'Iphone')
        const button = allProducts.filter(product => product.category === 'Button')

        const product = {
            android,
            iphone,
            button
        }

        res.send(product)

    })

    //productDetails  api
    app.get('/product/:id', async (req, res) => {

        const id = req.params.id;

        const product = await productCollection.findOne({ _id: new ObjectId(id) })
        res.send(product)
    })

    //book
    app.put('/booking', verifyJWT, async (req, res) => {

        let previousBookedItems = []

        //buyer email
        const filter = { email: req.query.email };

        const result = await userCollection.findOne(filter)

        //item info
        const itemData = {
            productId: req.body._id,
        };



        // booked key present or not 
        if (result?.booked) {
            previousBookedItems = previousBookedItems.concat(result?.booked)
        }

        previousBookedItems = previousBookedItems.concat(itemData)


        //update things

        const options = { upsert: true };
        const updateDoc = {
            $set: {
                booked: previousBookedItems
            },
        };

        const booked = await userCollection.updateOne(filter, updateDoc, options);

        res.send(booked)
    })


    // all booked items
    app.get('/bookedItems', async (req, res) => {
        const cursor = userCollection.find({})
        const allUser = await cursor.toArray()



        const hasBookedUser = allUser.filter(item => item.booked)


        let totalBooked = []

        for (item of hasBookedUser) {
            totalBooked = [...totalBooked, ...item.booked]
        }
        res.send(totalBooked);
    })

    //payment
    app.post("/create-payment-intent", async (req, res) => {
        const product = req.body;

        const amount = Number(product.productPrice) * 100

        console.log("Amount", amount);
        console.log(typeof amount);
        // Create a PaymentIntent with the order amount and currency
        if (amount) {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ]
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        }
    });

    app.post('/paid', async (req, res) => {
        const paymentInfo = req.body;
        console.log(paymentInfo);


        const item = await paidCollection.insertOne(paymentInfo)
        const email = paymentInfo.buyerEmail;
        const productId = paymentInfo.productInfo._id;

        console.log("Product id", productId);

        const user = await userCollection.findOne({ email })
        console.log(user);

        const prevBooked = user?.booked;

        const newBooked = prevBooked.filter(item => item.productId !== productId)

        const updateDoc = {
            $set: {
                booked: newBooked
            },
        };


        const result = await userCollection.updateOne({ email }, updateDoc);

        const deleteProduct = await productCollection.deleteOne({ _id: new ObjectId(productId) })
        res.send(result)
    })

    //all paid items
    app.get('/allPaid', async (req, res) => {
        const sellerEmail = req.query.email;

        const cursor = paidCollection.find({})
        const allPaidProducts = await cursor.toArray()

        const specificSellerPaidProducts = allPaidProducts.filter(item => item.productInfo.sellerEmail === sellerEmail)

        res.send(specificSellerPaidProducts)

    })


    // delete from cart 
    app.delete('/deleteCartItem', async (req, res) => {
        const userEmail = req.query.email;
        const productId = req.query.productId;

        const userInfo = await userCollection.findOne({ email: userEmail })

        const prevBooked = userInfo.booked;
        const newBooked = prevBooked.filter(item => item.productId !== productId)

        const updateDoc = {
            $set: {
                booked: newBooked
            },
        };

        const updateData = await userCollection.updateOne({ email: userEmail }, updateDoc)

        res.send(updateData)

    })

    //get bought item
    app.get('/boughtItem', async (req, res) => {
        const email = req.query.email;
        const filter = { buyerEmail: email }
        const cursor = paidCollection.find(filter)
        const boughtItem = await cursor.toArray()

        res.send(boughtItem)
    })


    // advertise item
    app.put('/advertise/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }

        const updateDoc = {
            $set: {
                advertise: 1
            }
        }

        const updateData = await productCollection.updateOne(filter, updateDoc)
        res.send(updateData)
    })

}

run().catch(error => { console.log(error); })
