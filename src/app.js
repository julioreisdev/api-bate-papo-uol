import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("OK");
});

app.listen(5000, () => {
  console.log("Servidor rodando");
});