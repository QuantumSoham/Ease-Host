require('dotenv').config();
const express= require('express')
const {generateSlug}= require('random-word-slugs')
const {ECSClient,RunTaskCommand}= require('@aws-sdk/client-ecs')
// const {Server}=require('socket.io')
const app=express()
const PORT= 9000

const ecsClient=new ECSClient({
    region:'us-east-1',
    credentials:{
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    logger:console
});
const config={
    CLUSTER:process.env.ECS_CLUSTER_ARN,
    TASK:process.env.ECS_TASK_DEFINITION_ARN
}

console.log('Config:',config);
app.use(express.json())

app.post('/project', async (req,res)=>{
    const { gitURL, slug }=req.body
    const projectSlug=slug ? slug: generateSlug()

    const command = new RunTaskCommand({
        cluster:config.CLUSTER,
        taskDefinition:config.TASK,
        launchType:'FARGATE',
        count:1,
        networkConfiguration:{
            awsvpcConfiguration:{
                assignPublicIp:'ENABLED',
                subnets:[
                    'subnet-08015466b4376bf42'
                ],
                securityGroups:['sg-00439541a01965bb4']
            }
        },
        overrides:{
            containerOverrides:[
                {
                    name:'builder-image',
                    environment:[
                        {name:'GIT_REPOSITORY_URL',
                            value:gitURL
                        },
                        {
                            name:'PROJECT_ID',
                            value:projectSlug
                        }
                    ]
                }
            ]
        }
    })
    await ecsClient.send(command);
    return res.json({status:'queued',data :{projectSlug, url:`http://${projectSlug}.localhost:8000/`}})
})
app.listen(PORT,()=>{
    console.log(`API Server is running on port ${PORT}`);
});