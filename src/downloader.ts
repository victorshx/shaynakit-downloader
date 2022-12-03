import axios from "axios";
import fs from "fs";
import { DownloadPage } from "./typings";

class ShaynaKitDownloader {
  private readonly maxWorkers: number = 5;
  private readonly maxRetries = 3;
  private readonly pages: DownloadPage[] = [];
  private processingPages: DownloadPage[] = [];

  public queueDownload(page: DownloadPage) {
    if (this.pages.find((p) => p.url === page.url)) return;
    this.pages.push(page);
    this.process();
  }

  public async onCompleted(action: () => void) {
    await new Promise(async (resolve) => {
      while (this.pages.length > 0 && this.processingPages.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      action();
      resolve(true);
    });
  }

  /// The way Shaynakit names their Figma files can be computed from their page name
  /// Page name: TrainToll Browse and Tickets Wireframe Mobile App Design
  ///
  /// S3 URL: https://shaynakitnew.s3.ap-southeast-1.amazonaws.com/TrainToll+Browse+and+Tickets+Wireframe+Mobile+App+Design.fig
  ///
  /// If it does not exist, it probably has this suffix where 1 is N
  /// https://shaynakitnew.s3.ap-southeast-1.amazonaws.com/TrainToll+Browse+and+Tickets+Wireframe+Mobile+App+Design+(Copy)+(1).fig
  private async downloadPage(page: DownloadPage): Promise<void> {
    let retryCount = this.maxRetries;
    const encodedFileName = page.name.trim().replaceAll(" ", "+");
    while (retryCount > 0) {
      try {
        let downloadUrl = `https://shaynakitnew.s3.ap-southeast-1.amazonaws.com/${encodedFileName}`;
        if (retryCount !== this.maxRetries) {
          downloadUrl += `+(Copy)+(${this.maxRetries - retryCount})`;
        }
        downloadUrl += ".fig";
        const directory = `./downloads/${page.category}`;
        const filePath = `${directory}/${encodedFileName}.fig`;
        if (fs.existsSync(filePath)) {
          if (fs.statSync(filePath).size > 0) break;
        } else if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }
        const writer = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          axios({ method: "get", url: downloadUrl, responseType: "stream" })
            .then((res) => {
              res.data.pipe(writer);
              writer.on("error", (err) => {
                throw err;
              });
              writer.on("close", () => {
                resolve(true);
              });
            })
            .catch((e) => {
              if (retryCount !== 0) {
                console.log(`Retrying ${encodedFileName}`);
              }
              reject(e);
            });
        });
      } catch (e) {
        if (retryCount === 0) throw e;
      } finally {
        retryCount--;
      }
    }
  }

  private async process() {
    if (this.processingPages.length >= this.maxWorkers) return;
    const page = this.pages.shift();
    if (!page) return;
    this.processingPages.push(page);
    try {
      console.log(`Starting to download ${page.name}`);
      await this.downloadPage(page);
      console.log(
        `Successfully downloaded ${page.name}. Queue length: ${this.pages.length}`
      );
    } catch (e) {
      console.error(`Fail to download ${page}. Error: ${e.response?.status}`);
    } finally {
      this.processingPages = this.processingPages.filter(
        (v) => v?.url !== page?.url
      );
      this.process();
    }
  }
}

export const shaynaKitDownloader = new ShaynaKitDownloader();
