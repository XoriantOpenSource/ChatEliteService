import { config, instance } from "t-webapi";
/**
 * Name collab
 */
config.appSettings.name = "Collabrative server";
config.appSettings.port = 443; // PORT_NUMBER_WHERE_YOU_WANT_TO_RUN_YOUR_APPLICATION

// Specifies what must be the log level verbose, info, debug, error
config.appSettings.logLevel = "debug";

// Specifies whether the connection must be secured or not
config.appSettings.secured = true;

// Specifies whether to create library docs or not
config.appSettings.libDocs = false;

// Specifies the default path for express
config.appSettings.defaultRedirect = "/v1/user/login";

// Specifies whether push notification must be enabled or not
config.appSettings.notification.enable = false;

// Specifies fcm autorization key if push notification enabled
config.appSettings.notification.firebaseObject = {
    url: "https://fcm.googleapis.com/fcm/send",
    authorization_key: "key=YOUR_FCM_AUTORIZATION_KEY"
};

// Specifies whether email notification must be enabled or not
config.appSettings.email.enable = false;

// Specifies notification email and current deployed domain name if email notification enabled
config.appSettings.email.emailObject = {
    notificationEmailId: "YOUR_EMAIL_WHICH_WILL_SEND_MAILS_FOR_APPLICATION",
    applicationUrl: "https://YOUR_APPLICATION_URL/"
};

// MongoDB connection details
config.appSettings.mongoConnection = {
    url: "mongodb://YOUR_USER_NAME:YOUR_USER_PASSWORD@localhost/collabTool?authSource=DATABASE_COLLECTION_WHERE_USER_CREATED",
    options: {
        server: {
            poolSize: 40
        }
    }
};

// Single sign-on details for GitHub
config.appSettings.SSO.config = {
    strategy: "github",
    github: {
        clientID: "YOUR_GITHUB_CLIENT_ID",
        clientSecret: "YOUR_GITHUB_CLIENT_SECRET",
        callbackURL: "YOUR_CALLBACK_URL_FOR_APPLICATION", // example = https://localhost:1234/v1/user/login/callback
        scope: ["user:email"]
    }
};

// Creates express server
instance.getExpressInst.createServer();
