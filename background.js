const maliciousSites = [
  "www.eicar.org",
  "testsafebrowsing.appspot.com",
  "www.amtso.org",
  "phishtank.com",
  "www.wicar.org",
  "mixed-script.badssl.com",
  "badssl.com",
  "https://amtso.eicar.org/eicar.com",
  "amtso.org/feature-settings-check-drive-by-download"
];

const testPageURLs = [
  "https://testsafebrowsing.appspot.com/downloads/malware",
  "https://www.amtso.org/feature-settings-check-drive-by-download/",
  "https://amtso.eicar.org/eicar.com"
  // Add other test URLs from the page here
];

let tabDownloadHistory = {};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log(`Tab updated: Tab ID = ${tabId}, URL = ${changeInfo.url}`);
    checkForMaliciousSite(changeInfo.url, null, tabId); // Modified to pass tabId
    checkForTestPage(changeInfo.url, null, tabId); // Modified to pass tabId
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
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tabId = tabs[0].id;
      tabDownloadHistory[tabId] = {
        downloadInitiated: true,
        downloadTime: Date.now()
      };
      checkForMaliciousSite(downloadItem.finalUrl, downloadItem.id, tabId);
      checkForTestPage(downloadItem.finalUrl, downloadItem.id, tabId);
    }
  });
});

function checkForMaliciousSite(url, downloadId, tabId) {
  console.log(`Checking if ${url} is a known malicious site.`);
  const urlObj = new URL(url);
  if (maliciousSites.some(site => urlObj.hostname.includes(site))) {
    console.warn(`Alert: The site ${url} is known for hosting malicious content!`);
    if (downloadId) {
      chrome.downloads.cancel(downloadId);
    } else {
      handleDriveByDownload(tabId);
    }
  }
}

function checkForTestPage(url, downloadId, tabId) {
  console.log(`Checking if ${url} is a test page.`);
  const urlObj = new URL(url);
  if (testPageURLs.includes(urlObj.href)) {
    console.warn(`Alert: ${url} is a test page for downloading potentially harmful content!`);
    if (downloadId) {
      chrome.downloads.cancel(downloadId);
	  console.warn("Download cancelled");
    } else {
      chrome.downloads.pause(downloadId);
    }
  }
}

function handleDriveByDownload(tabId) {
  console.warn(`Potential 'drive-by' download detected in tab ${tabId}.`);
  // Add logic here to handle a drive-by download scenario
  chrome.downloads.cancel(downloadId);
  console.warn("Drive-by download cancelled");
}

function checkRecentDownloads(tabUrl, tabId) {
  console.log(`Checking downloads for tab: ${tabId}`);

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

