import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uoploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { refreshToken, accessToken }

    } catch (error) {
        throw new ApiError(500, "something is went wrong while generate access and refresh token");

    }
}



//************ User registration to use post request  
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
    //check for images, and avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.lentgh > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
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
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    //check for user creation 
    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering user");

    }

    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successoly")
    )
})

// **********Login User to use post request  

const loginUser = asyncHandler(async (req, res) => {
    // get data in req body
    const { email, username, password } = req.body

    //username or email is not emety
    if (!(username || !email)) {
        throw new ApiError(400, "email or password is required");
    }

    // find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(404, "password is not correct");

    }

    //Access and Refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password,-refreshToken")

    // send cookie and response
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In successful"
            )
        )
})

// *************** Logout User to use post request  

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
})

//*************** Refresh token Access to use post request   */


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken._id)
        if (!user) {
            throw new ApiError(401, "invalide refresh token")
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh tokren is expired or used")

        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newrefreshToken } = await generateAccessAndRefreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newrefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newrefreshToken }, "Access token refreshed"))

    } catch (error) {
        throw new ApiError(401, error?.message, "invalid refresh token")

    }

})

//*************** change the current password */

const changeCurrentPassword = asyncHandler(async (req, res) => {

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is not correct")
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

//****************** fetch CurrentUser */

const currentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "current user fetch successfully")
})

//**************updateUser detailes(fullName and email) */

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");

    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,   //fulName=fullName
                email       //email=email
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "User details updated successfully"))
})

//***************updateUserAvatar */
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = await req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // delete old Avatar from cloudinary
    const olduser = await User.findById(req.user._id)
    const oldAvatarurl = olduser.avatar
    if (oldAvatarurl) {
        const publicId = oldAvatarurl.split('/').pop().split('.')[0]
        await cloudinary.uploader.destroy(publicId)
    }

    const avatar = await uoploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, " error while uploading avatar on cloudinary")
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))
})

//*********** update user coverimage */

const updateUsercoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = await req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "cover Image file is required")
    }
    const coverImage = await uoploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, " error while uploading cover image on cloudinary")
    }
    // delete old coverimage from cloudinary

    const olduser = await User.findById(req.user._id)
    const oldAvatarurl = olduser.avatar
    if (oldAvatarurl) {
        const publicId = oldAvatarurl.split('/').pop().split('.')[0]
        await cloudinary.uploader.destroy(publicId)
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "coverImage updated successfully"))
})
const geUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is required")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subcriptions",      //   add to subscriber to channel
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            },
            $lookup: {
                from: "subcriptions",     // add to channel to subscriber 
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"    // count of subscriber  (used $ before subscribers because it is an field)
                },
                cahhnelSubscribedToCount: {
                    $size: "$subscribedTo"  // count of channel subscribed to
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user._id, "$subscribers.subscriber"] },  // check if user is subscribed to channel
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                email: 1
            }
        }

    ])
    if (!channel?.length) {
        throw new ApiError(404, "Channel not found")
    }
    console.log(channel)
    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchhistory",
                foreignField: "_id",
                as: "watchHostory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",         //name of lookup result array
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
return res
.status(200)
.json(new ApiResponse(200, user[0].watchHostory), " watch History successfuly")

})

export {
    registerUser, loginUser, logoutUser,
    refreshAccessToken, changeCurrentPassword, currentUser,
    updateAccountDetails, updateUserAvatar, updateUsercoverImage,
    geUserChannelProfile, getWatchHistory
}

