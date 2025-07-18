require('dotenv').config();
const { ECSClient, ListClustersCommand } = require('@aws-sdk/client-ecs');

const ecsClient = new ECSClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const testECSConnection = async () => {
    try {
        const command = new ListClustersCommand({});
        const response = await ecsClient.send(command);
        console.log("ECS Clusters:", response.clusterArns);
    } catch (error) {
        console.error("Error connecting to ECS:", error);
    }
};

testECSConnection();
