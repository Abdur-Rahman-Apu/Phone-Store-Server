const express = require('express');

const cors = require('cors');

const app = express()

app.use(cors())

app.use(express.json())

require('dotenv').config()

var jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000

app.get('/', async (req, res) => {
    res.send('Server is running');
})

app.listen(port, () => {
    console.log("Server is running on port", port);
})


const { MongoClient, ServerApiVersion } = require('mongodb');
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
            res.send({ result: 1, role: result.role })
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

}

run().catch(error => { console.log(error); })
