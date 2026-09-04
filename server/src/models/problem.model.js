import mongoose from "mongoose";

const problemSchema = new mongoose.Schema(
    {
    //   userId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //     required: true,
    //   },
      problemInfo: {
        problemName: {
          type: String,
          required: true,
          trim: true,
          minlength: 3,
          maxlength: 100,
        },
        problemUrl: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          default: null,
        },
        platform: {
          type: String,
          enum: ["leetcode", "gfg", "codechef", "codeforces", "other"],
          required: true,
        },
        difficulty: {
          type: String,
          enum: ["easy", "medium", "hard"],
          required: true,
        },
        // topicIds: [
        //   {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Topic",
        //   },
        // ],
        tags: [
          {
            type: String,
          },
        ],
      },
      userLearningInfo: {
        whatILearned: {
          type: String,
  
          maxlength: 1000,
        },
        whatIStruggledWith: {
          type: String,
  
          maxlength: 1000,
        },
        confidence: {
          type: Number,
          required: true,
          min: 0,
          max: 5,
        },
        mistake: {
          type: String,
  
          maxlength: 1000,
        },
        firstSolvedAt: {
          type: Date,
          required: true,
        },
        lastSolvedAt: {
          type: Date,
          required: true,
        },
      },
    },
    { timestamps: true }
  );
  
const Problem = mongoose.model("Problem", problemSchema);

export default Problem;