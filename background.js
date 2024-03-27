const maliciousSites = [
  "www.eicar.org",
  "testsafebrowsing.appspot.com",
  "www.amtso.org",
  "phishtank.com",
  "www.wicar.org",
  "mixed-script.badssl.com",
  "badssl.com"
];

let tabDownloadHistory = {};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log(`Tab updated: Tab ID = ${tabId}, URL = ${changeInfo.url}`);
    checkForMaliciousSite(changeInfo.url);
    checkRecentDownloads(changeInfo.url, tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabDownloadHistory[tabId] && tabDownloadHistory[tabId].downloadInitiated) {
    const timeSinceDownload = Date.now() - tabDownloadHistory[tabId].downloadTime;
    if (timeSinceDownload < 30000) { // 30 seconds threshold
      console.warn(`Tab with ID ${tabId} closed shortly after a download. This may be a drive-by download attempt.`);
    }
  }
  delete tabDownloadHistory[tabId];
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  if (downloadItem.referrer) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        tabDownloadHistory[tabId] = {
          downloadInitiated: true,
          downloadTime: Date.now()
        };
      }
    });
  }
});

function checkForMaliciousSite(url) {
  console.log(`Checking if ${url} is a known malicious site.`);
  const urlObj = new URL(url);
  if (maliciousSites.includes(urlObj.hostname)) {
    console.warn(`Alert: The site ${url} is known for hosting malicious content!`);
  } else {
    console.log(`${url} is not in the list of known malicious sites.`);
  }
}

function checkRecentDownloads(tabUrl, tabId) {
  console.log(`Checking downloads for tab: ${tabId}`);

  // Set the time period to consider for 'recent' downloads (e.g., last 5 minutes)
  let fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  let queryStartTime = fiveMinutesAgo.toISOString();

  chrome.downloads.search({ startTime: queryStartTime }, (downloads) => {
    if (downloads.length === 0) {
      console.log("No downloads in the specified time frame to check.");
      return;
    }

    console.log(`Found ${downloads.length} downloads since ${queryStartTime}. Inspecting each for safety.`);
    for (let download of downloads) {
      console.log(`Inspecting download: ID = ${download.id}, URL = ${download.url}, MIME = ${download.mime}, Filename = ${download.filename}`);
      
      if (isSuspiciousMIMEType(download.mime)) {
        console.warn(`Suspicious MIME type detected for download: ${download.filename}.`);
        // Additional actions for suspicious MIME type can be added here
      }

      if (download.referrer === tabUrl && download.byExtensionId === undefined) {
        console.warn(`Potential 'drive-by' download detected: ${download.filename}. Attempting to remove.`);
        chrome.downloads.removeFile(download.id, () => {
          console.log(`Removed 'drive-by' download: ${download.filename}`);
        });
      } else {
        console.log(`Download ${download.filename} does not appear to be a 'drive-by' download.`);
      }
    }
  });
}

function isSuspiciousMIMEType(mimeType) {
  // Define suspicious MIME types
  const suspiciousMimeTypes = ['application/exe', 'application/x-msdownload', 'application/x-sh'];
  return suspiciousMimeTypes.includes(mimeType);
}
