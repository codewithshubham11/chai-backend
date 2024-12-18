import mongoose, { Schema } from "mongoose";
import { JsonWebToken } from "jsonwebtoken";
import bcrypt from bcrypt;


const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowerCase: true,
        trim: true,
        intex: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowerCase: true,
        trim: true,
    },
    fullname: {
        type: String,
        required: true,
        trim: true,
        intex: true
    },
    avatar: {
        type: String, //cloudinary url
        required: true,
    },
    coverImage: {
        type: String, //cloudinary url
    },
    watchHistory: [
        {
            type: Schema.Type.ObjectId,
            ref: "Video"
        }
    ],
    password: {
        type: String,
        required: [true, "Password is required"]
    },
    refreshToken: {
        type: String,
    }
},
    {
        timestamps: true
    })

userSchema.pre("save",async function(next)  {
    if (!this.isModified("password")) return next();

     this.password=bcrypt.hash(this.password,10)
    next();   
})
userSchema.methods.isPasswordCorrect=async function  (password) {
 return await bcrypt.compare(password,this.password)
    
}
userSchema.methods.generateAccessToken=function(){
   return JsonWebToken.sign({
        _id:this._id,
        email:this.email,
        username:this.username,
        fullname:this.fullname
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn:process.env.ACCESS_TOKEN_EXPIRY
    }
)
}

userSchema.methods.generateRefreshToken=function(){
    return JsonWebToken.sign({
        _id:this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRY
    }
)
}

export const User = mongoose.model("User", userSchema)