import { dbBase, schema } from "t-webapi";

/**
 * @class
 * @classdesc  Provides configuration settings for gradewise feature access
 * @extends dbBase
 */
@schema
export default class appConfig extends dbBase {

    public $up = [{
        appConfig: {
            gradeSettings: [
                {
                    feature: "document",
                    grade: []
                },
                {
                    feature: "transferChat",
                    grade: []
                },
                {
                    feature: "addUser",
                    grade: []
                },
                {
                    feature: "leaveGroup",
                    grade: []
                },
                {
                    feature: "downloadChat",
                    grade: []
                },
                {
                    feature: "createGroup",
                    grade: []
                }]
        }
    }];

    private $schema = {
        appConfig: {
            gradeSettings: [{
                feature: this.dataType.string,
                grade: [this.dataType.string]
            }]
        }
    };

    constructor(a?) {
        super(a);

    }
}
