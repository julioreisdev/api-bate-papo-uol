import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const cliente = new MongoClient(process.env.MONGO_URL);
let db;

cliente.connect().then(() => {
  db = cliente.db("batePapoUol");
});

const userSchema = Joi.object({
  name: Joi.string().min(1).required(),
});

app.get("/participants", async (req, res) => {
  try {
    const users = await db.collection("users").find().toArray();
    res.send(users);
  } catch (error) {
    res.send(error).status(500);
  }
});

app.post("/participants", async (req, res) => {
  const { error, values } = userSchema.validate(req.body);
  if (error) {
    res.sendStatus(422);
    return;
  }
  try {
    const user = await db.collection("users").findOne(req.body);
    if (user) {
      res.sendStatus(409);
    } else {
      let nome = req.body.name;
      let hora = Date.now();
      await db.collection("users").insertOne({ name: nome, lastStatus: hora });
      await db.collection("messages").insertOne({
        from: nome,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
      res.sendStatus(201);
    }
  } catch (error) {
    res.send(error).status(500);
  }
});

app.listen(5000, () => {
  console.log("Servidor rodando");
});
