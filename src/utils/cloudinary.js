import { v2 as cloudinary } from 'cloudinary';
import { fs } from "fs";

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
});

// upload Localfilepath
const uoploadOnCloudinary = async (localFilepath) => {
    try {
        if (!localFilepath) return null
        const response=await cloudinary.uploader.upload(localFilepath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        console.log("file is uploaded", response.url);
        return response

    } catch (error) {
        fs.unlinkSync(localFilepath) //remove the locally saved temporary file as the upload operation got failed
        return null;

    }
}

export {uoploadOnCloudinary}