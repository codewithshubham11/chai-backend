import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uoploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    //get user detailes from frontend
    const { fullName, email, password, username } = req.body;

    //validation - not empty
    if (
        [fullName, email, password, username].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    //check if user already exists:username,email
    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    if (existedUser) {
        throw new ApiError(409, "user with email or username already exists");

    }
    //check for images, and for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    //upload them to cloudinary
    const avatar = await uoploadOnCloudinary(avatarLocalPath)
    const coverImage = await uoploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //create user object -- create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    
    //remove password and refresh token field from response
    const createdUser=await User.findById(user._id).select("-password -refreshToken")

    //check for user creation 
    if (!createdUser) {
        throw new ApiError(500,"something went wrong while registering user");
        
    }

    // return res
    return res.status(201).json(
       new ApiResponse(200,createdUser,"user registered successoly")
    )
})

export { registerUser }
