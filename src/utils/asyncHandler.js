const asyncHandler = (requestHandler) => {
   return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
            catch((err) => next(err))
    }
}

export { asyncHandler }


// const asyncHandlerb =()=>{}
// const asyncHandler=(func)=>{()=>{}}
// const asyncHandler=(func)=>async()=>{}
// const asyncHandler=(func)=>async()=>{}

// const  asyncHandler=(fun)=>async(req,res,next)=>{
//     try {
//         await fun(req,res,next)
//     } catch (error) {
//         res.status(error.code||500).json({
//             success:false,
//             message:error.message
//         })
//     }
// }