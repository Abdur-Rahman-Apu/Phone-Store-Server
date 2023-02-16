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

async function run() {


    const categoriesCollection = client.db("phonesStore").collection("categories")


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
}

run().catch(error => { console.log(error); })
