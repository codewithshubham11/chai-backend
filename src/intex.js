import app  from "./app.js";
import connectDB from "./db/intex.js";
import dotenv from "dotenv";

dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server has been connect at port: ${process.env.PORT}`)
    })
    
})


.catch((err)=>{
    console.log("MONGODB connection failed!!!",err)
})




















