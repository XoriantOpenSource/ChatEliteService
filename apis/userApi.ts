
import { api, apiControllerBase, config, instance, _ } from "t-webapi";
import * as  path from "path";
import userModel from "../schema/users";
import configModel from "../schema/appConfig";
import maillingService from "../services/mailingService";
import getService from "../services/getService";
import deviceModel from "../schema/devices";
import apiService from "../services/apiService";

/**
 * @class
 * @classdesc Handles all user related requests
 * @extends apiControllerBase
 */
export class userController extends apiControllerBase {

    /**
     * @function postAuthenticate
     * @param  $data User details like grade,user_id,user_name
     * @returns A token for a particular user
     * @description Authenticates a user and returns an encrypted token for that particular user. This token is unique for each user.
     */
    @api({
        url: "/authenticate"
    })
    public async postAuthenticate($data) {
        const encObj = instance.createObjEncDecObj.encrypt($data, 1000);
        return this.success({ token: encObj });
    }

    /**
     * @function postRejoin
     * @param  $user User details
     * @param  $data Socket ID of the user
     * @description A socket corresponds to a user logged in on a device. It might get disconnected. Whenever the socket rejoins the room, the api updates the database with the new socket value eliminating the old value of the socket for that user.
     */
    @api({
        url: "/rejoin",
        authorize: true
    })
    public async postRejoin($user, $data) {
        const user: any = await new userModel().findOne({ user_id: $user.user_id });
        user.socket_id = $data.socket_id;
        await new userModel().update({ user_id: user.user_id }, user);
        return this.success({});
    }

    /**
     * @function getAppConfig
     * @returns A configuration settings object
     * @description Returns a configuration settings object. This object contains details like what features are accessible to which grades etc.
     */
    @api({
        url: "/appConfig",
        authorize: true
    })
    public async getAppConfig() {
        let configurations: any = await new configModel().find({}, "appConfig");
        configurations = configurations[0].appConfig;
        return this.success(configurations);
    }

    /**
     * @function postUser
     * @param  $data Consists of username and password
     * @description A new user can be registered using this api.
     */
    @api({ url: "/register" })
    public async postUser($data) {
        const user = await new userModel().findOne({ user_name: $data.user_name, password: $data.password });
        if (user) {
            return this.badRequest("User already present in database. Enter other user name and password");
        } else {
            $data.user_id = $data.user_name;
            return this.success(await new userModel().create($data));
        }
    }

    /**
     * @function postLogin
     * @description Login request for demoLogin.
     */
    @api({ url: "/login" })
    public async postLogin($data) {

        const user = await new userModel().findOne({ user_name: $data.user_name, password: $data.password });
        if (user) {
            return this.success(user);
        } else {
            return this.badRequest("Invalid user name or password");
        }
    }

    // For GitHub SSO login uncomment this lines and comment above postLogin function
    // /**
    //  * @function getLogin
    //  * @description Redirects to SSO configured page (github).
    //  */
    // @api({
    //     url: "/login",
    //     middlewares: [instance.getSSOInst.passport.authenticate(config.appSettings.SSO.config.strategy, { scope: ["user:email"] })]
    // })
    // public async getLogin($data) { }

    // /**
    //  * @function getLogincallback
    //  * @param  $user Consists of user details from sso provider
    //  * @description Redirects to the home page on successful login to the application.
    //  */
    // @api({
    //     url: "/login/callback",
    //     middlewares: [instance.getSSOInst.passport.authenticate(config.appSettings.SSO.config.strategy, { failureRedirect: "/" })]
    // })
    // public async getLogincallback($user) {
    //     let email = null;
    //     if ($user.emails.length && $user.emails[0].value) {
    //         email = $user.emails[0].value;
    //     }
    //      if(!$user.displayName){
    //          $user.displayName = $user.username;
    //      }
    //     const resData = instance.createObjEncDecObj.encrypt({
    //         user_id: $user.username,
    //         user_name: $user.displayName,
    //         email_id: email,
    //         profile_img: $user._json.avatar_url
    //     }, 10000);

    //     return this.redirect("/app?data=" + encodeURIComponent(resData));
    // }

    /**
     * @function getAllUsersFromDb
     * @param $user User details of the request sender
     * @returns An array of all other users from DB except self
     * @description Fetches all users details from database. It returns a list of all the users except the requestor.
     */
    @api({
        url: "/allUsersFromDb",
        authorize: true
    })
    public async getAllUsersFromDb($user) {
        let sortedUsers: any = [];
        let users: any = await new userModel().findAll("user_id user_name is_online online_status last_online isInviteUser profile_img email_id");
        if (users) {
            users = users.filter((obj: any) => {
                const con = obj.user_id !== $user.user_id && !obj.isInviteUser;
                return con;
            });
            users.forEach((element) => {
                element._doc.is_not_logged_in = false;
            });
            sortedUsers = _.sortBy(users, (val: any) => val.online_status);
        }
        return this.success(sortedUsers);
    }

    /**
     * @function postDeviceInfo
     * @param  $user User details of the request sender
     * @param  $data Device ID and platform used
     * @description In order to send notification, firebase is used. A particular device's id is the identifier to send a particular notification. The api stores the device id for notification sending.
     */
    @api({
        url: "/deviceInfo",
        authorize: true
    })
    public async postDeviceInfo($user, $data) {
        let user: any;
        const sameDeviceIdUsers: any = await new deviceModel().find({ "device.device_id": $data.device_id });
        for (user of sameDeviceIdUsers) {
            await new deviceModel().update({ "user_id": user.user_id, "device.device_id": $data.device_id }, { $set: { "device.$.is_active": false } });
        }
        const res: any = await new deviceModel().findOne({ "user_id": $user.user_id, "device.device_id": $data.device_id }, { "device.$": 1 });
        if (!res) {
            user = await new deviceModel().find({ user_id: $user.user_id });
            if (user.length) {
                await new deviceModel().update({ user_id: $user.user_id }, { $push: { device: $data } });
            } else {
                await new deviceModel().create({
                    user_id: $user.user_id,
                    device: [$data]
                });
            }
        } else if (!res.device[0].is_active) {
            await new deviceModel().update({ "user_id": $user.user_id, "device.device_id": $data.device_id }, { $set: { "device.$.is_active": true } });

            if (res.device[0].version !== $data.version) {
                await new deviceModel().update({ "user_id": $user.user_id, "device.device_id": $data.device_id }, { $set: { "device.$.version": $data.version } });
            }
        }
        return this.success({});
    }

    /**
     * @function postLogout
     * @param  $user User details of the request sender
     * @param  $data Device Id
     * @description Sets the status of device as inactive after logging out
     */
    @api({
        url: "/logout",
        authorize: true
    })
    public async postLogout($user, $data) {
        const res: any = await new deviceModel().findOne({ "user_id": $user.user_id, "device.device_id": $data.device_id }, { "device.$": 1 });
        if (res) {
            await new deviceModel().update({ "user_id": $user.user_id, "device.device_id": $data.device_id }, { $set: { "device.$.is_active": false } });
        }

        return this.success({});
    }
}
