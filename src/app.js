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

const messageSchema = Joi.object({
  to: Joi.string().min(1).required(),
  text: Joi.string().min(1).required(),
  type: Joi.string().valid("message", "private_message").required(),
  from: Joi.string().min(1).required()
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
  const { error, values } = userSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const detalhes = error.details.map((detail) => detail.message);
    res.status(422).send(detalhes);
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

app.post("/messages", async (req, res) => {
  const { error, values } = messageSchema.validate({
    to: req.body.to,
    text: req.body.text,
    type: req.body.type,
    from: req.headers.user
  }, {
    abortEarly: false,
  });
  const from = req.headers.user;
  if (error) {
    const detalhes = error.details.map((detail) => detail.message);
    res.status(422).send(detalhes);
    return;
  }
  try {
    const user = await db.collection("users").findOne({ name: from });
    if (!user) {
      res.status(422).send("Invalid user!");
      return;
    }
  } catch (error) {
    res.status(500).send(error);
  }
  try {
    await db.collection("messages").insertOne({
      to: req.body.to,
      text: req.body.text,
      type: req.body.type,
      from: from,
      time: dayjs().format("HH:mm:ss"),
    });
  } catch (error) {
    res.status(500).send(error);
  }
  res.sendStatus(201);
});

app.get("/messages", async (req, res) => {
  const limite = req.query.limit;
  const user = req.headers.user;
  let mensagens;
  try {
    const userExiste = await db.collection("users").findOne({ name: user });
    if (!userExiste) {
      res.status(404).send("Invalid user");
      return;
    }
  } catch (error) {
    res.status(500).send(error);
  }
  try {
    mensagens = await db
      .collection("messages")
      .find()
      .sort({ $natural: -1 })
      .toArray();
  } catch (error) {
    res.status(500).send(error);
  }
  const mensagensValidas = mensagens.filter((mensagen) => {
    if (
      mensagen.to === "Todos" ||
      mensagen.to === user ||
      mensagen.from === user
    ) {
      return mensagen;
    }
    return false;
  });
  let totalMensagensVisiveis = [];
  if (limite) {
    let limit = parseInt(limite);
    for (let i = 0; i < limit; i++) {
      totalMensagensVisiveis.push(mensagensValidas[i]);
      if (i === mensagensValidas.length - 1) {
        break;
      }
    }
  } else {
    let limit = 100;
    for (let i = 0; i < limit; i++) {
      totalMensagensVisiveis.push(mensagensValidas[i]);
      if (i === mensagensValidas.length - 1) {
        break;
      }
    }
  }
  res.send(totalMensagensVisiveis);
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    const userExiste = await db.collection("users").findOne({ name: user });
    if (!userExiste) {
      res.sendStatus(404);
      return;
    }
  } catch (error) {
    res.status(500).send(error);
  }
  try {
    await db
      .collection("users")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
  } catch (error) {
    res.status(500).send(error);
  }
  res.sendStatus(200);
});

//DELETA USER INATIVO
setInterval(async () => {
  let usuarios;
  try {
    usuarios = await db.collection("users").find().toArray();
  } catch (error) {
    console.log(error);
  }
  for (let i = 0; i < usuarios.length; i++) {
    let hora = Date.now();
    if (hora - usuarios[i].lastStatus >= 10000) {
      let userDeleted;
      try {
        userDeleted = await db
          .collection("users")
          .deleteOne({ name: usuarios[i].name });
        if (userDeleted) {
          try {
            await db.collection("messages").insertOne({
              from: usuarios[i].name,
              to: "Todos",
              text: "sai da sala...",
              type: "status",
              time: dayjs().format("HH:mm:ss"),
            });
          } catch (error) {
            console.log(error);
          }
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
}, 10000000);

app.listen(5000, () => {
  console.log("Servidor rodando");
});
