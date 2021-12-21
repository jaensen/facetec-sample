import { Config } from "../../../Config";
import { FaceTecSDK } from "../../../core-sdk/FaceTecSDK.js/FaceTecSDK";
import type { FaceTecSessionResult, FaceTecFaceScanResultCallback, FaceTecFaceScanProcessor } from "../../../core-sdk/FaceTecSDK.js/FaceTecPublicApi";

export class EnrollmentProcessor implements FaceTecFaceScanProcessor {

  onSuccess: (result: FaceTecSessionResult) => void = () => {};
  onError: (e:Error) => void = () => {};

  private _sessionResult: FaceTecSessionResult|undefined = undefined;

  private _groupName:string;
  private _3dDbRef:string;

  constructor(sessionToken: string, groupName:string, _3dDbRef:string) {
    new FaceTecSDK.FaceTecSession(
      this,
      sessionToken
    );
    this._groupName = groupName;
    this._3dDbRef = _3dDbRef;
  }

  //
  // Handling the Result of a FaceScan
  //
  public async processSessionResultWhileFaceTecSDKWaits(
    sessionResult: FaceTecSessionResult,
    faceScanResultCallback: FaceTecFaceScanResultCallback) {

    this._sessionResult = sessionResult;

    //
    // Part 3:  Handles early exit scenarios where there is no FaceScan to handle -- i.e. User Cancellation, Timeouts, etc.
    //
    if(sessionResult.status !== FaceTecSDK.FaceTecSessionStatus.SessionCompletedSuccessfully) {
      faceScanResultCallback.cancel();
      if (this.onError) {
        this.onError(new Error("Session was not completed successfully, cancelling.  Session Status: " + FaceTecSDK.FaceTecSessionStatus[sessionResult.status]));
      }
      return;
    }

    const parameters = {
      faceScan: sessionResult.faceScan,
      auditTrailImage: sessionResult.auditTrail[0],
      lowQualityAuditTrailImage: sessionResult.lowQualityAuditTrail[0],
      sessionId: sessionResult.sessionId,
      externalDatabaseRefID: this._3dDbRef,
      groupName: this._groupName
    };

    //
    // Part 5:  Make the Networking Call to Your Servers.  Below is just example code, you are free to customize based on how your own API works.
    //
    const postRequest = await fetch(Config.BaseURL + "/enrollment-3d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Key": Config.DeviceKeyIdentifier,
        "X-User-Agent": FaceTecSDK.createFaceTecAPIUserAgentString(sessionResult.sessionId as string)
      },
      body: JSON.stringify(parameters)
    });

    const resultJson = await postRequest.json();
    const scanResultBlob = resultJson.scanResultBlob;

    if(resultJson.wasProcessed) {
      // Demonstrates dynamically setting the Success Screen Message.
      FaceTecSDK.FaceTecCustomization.setOverrideResultScreenSuccessMessage("Bot says: You aren't a bot.");

      // In v9.2.0+, simply pass in scanResultBlob to the proceedToNextStep function to advance the User flow.
      // scanResultBlob is a proprietary, encrypted blob that controls the logic for what happens next for the User.
      faceScanResultCallback.proceedToNextStep(scanResultBlob);
    }
    else
    {
      faceScanResultCallback.cancel();
      if (this.onError) {
        this.onError(new Error("Unexpected API response, cancelling out."));
      }
    }
  }

  //
  // This function gets called after the FaceTec SDK is completely done.
  // There are no parameters because you have already been passed all data in the
  // "processSessionWhileFaceTecSDKWaits" function and have already handled all of your own results.
  //
  public onFaceTecSDKCompletelyDone = () => {
    //
    // DEVELOPER NOTE:  onFaceTecSDKCompletelyDone() is called after you signal the FaceTec SDK with success() or cancel().
    // Calling a custom function on the Sample App Controller is done for demonstration purposes to show you that here is where you get control back from the FaceTec SDK.
    //
    console.log(this._sessionResult);

    if (!this._sessionResult) {
      throw new Error(`No _sessionResult!`);
    }

    if (this._sessionResult.isCompletelyDone && this.onSuccess) {
      this.onSuccess(this._sessionResult);
    }
  }
}
