---
title: "Swift IIS log analytics with Elastic and Kibana"
description: "I have been playing around with Elastic and trying to figure out how to use it, and more importantly what to use it for. In TimeLog, we currently have a set…"
pubDate: "2016-04-04"
permalink: "2016/04/04/swift-iis-log-analytics-with-elastic-and-kibana"
---
I have been playing around with Elastic and trying to figure out how to use it, and more importantly what to use it for. In TimeLog, we currently have a set of web servers with several IIS websites and we want to be able to monitor basic usage across all sites, something that we currently are not doing. Each customer has their own IIS application, so we see almost identical URLs in the standard W3C IIS logs apart from the first sub-folder which we refer to as shortname. We want to be able to track views on each page across these sites and servers.

From my point of view, Elastic is basically a big database that accepts all kinds of content and a small into big data analytics. However, my perception right now is that you have to think in terms of text strings only to get the benefits. The API supports standard JSON so that is straight forward to use for pushing data to the clusters – not tables and for me this is the first indication that it is not a traditional database. The schema is generated and possibly extended on the fly.

Going back to my initial goal, getting something meaningful out of the standard IIS log files. The W3C format is simple and a simple split string enables direct access to each sub element. Some text manipulation is required to extract the application name and the unique page name as well as the shortname. To get each information piece isolated is crucial for cross site analytics. This is a small sample:

```
Fields: date time s-ip cs-method cs-uri-stem cs-uri-query s-port cs-username c-ip cs(User-Agent) cs(Cookie) cs(Referer) sc-status sc-substatus sc-win32-status time-taken
2015-03-04 13:35:25 ::1 GET /tlp_patch_branch - 80 - ::1 Mozilla/5.0+(Windows+NT+6.3;+Win64;+x64)+AppleWebKit/537.36+(KHTML,+like+Gecko)+Chrome/41.0.2272.74+Safari/537.36 LanguageID=1;+projecttotalsviewstate=simple;+projectdetailstate=false;+projecttotalsstate=false;+paymentplantotalsstate=false - 301 0 0 4432
```

Elastic and Kibana would easily support near-real-time updates, but for my current needs manual updates are just fine and the complexity is reduced. Additional, I want to support deleting clusters at any time and be able to restore them without any concern. Additionally, I’m currently not interested in long term analytics either. I want to be able to quickly run them at will and modify them. I’m really into PowerShell, so it is a natural choice. I like the simplicity from the outside and the strengths from the inside. The transition from C# is relatively easy and all .NET libraries can be utilized.

I have decided to part the requests into five content groups: Web, Reporting API, Transactional API, Resource and System. This is based on simple lists of keywords to sort them into the categories. Additionally, I have a couple of CSV files to enrich the data with details about application pool and site status (e.g. production, demo, pilot etc.) which comes from a separate system.

```
# All log files are copied there before starting
$importLocation = "c:\elastic\import-iis"

# Cache list of application pools
# SELECT tblCustomerProduct.ShortName, tblCustomerProduct.ApplicationPool FROM dbo.tblCustomerProduct WHERE tblCustomerProduct.Status < 4 AND tblCustomerProduct.InstallationType = 0 ORDER BY 1 DESC
$appPoolFile = "C:\elastic\import-apppools\applicationpools.csv"
$appPoolList = @{}
$appPoolLines = Get-Content $appPoolFile
foreach($line in $appPoolLines) {
    $splitter = $line.ToString().Split(",")
    $appPoolList.Add($splitter[0], $splitter[1].Replace(" ", "").Replace(".", "").Replace("#", "").Replace("timelogcom", "_pool"))
}
$appPoolLines = @{}

# Cache list of customer product status
# SELECT tblCustomerProduct.ShortName, tblCustomerProduct.Status FROM dbo.tblCustomerProduct WHERE tblCustomerProduct.Status < 4 AND tblCustomerProduct.InstallationType = 0 ORDER BY 1 DESC
$cpStatusFile = "C:\elastic\import-apppools\customerproductstatus.csv"
$cpStatusList = @{}
$cpStatusLines = Get-Content $cpStatusFile
foreach($line in $cpStatusLines) {
    $splitter = $line.ToString().Split(",")
    $cpStatusList.Add($splitter[0], $splitter[1])
}
$cpStatusLines = @{}

[GC]::Collect() # Something is not releasing memory

$contentList = ".jpg",".gif",".css",".js",".ico",".png"
$systemList = "logout_frame.aspx","login_frame.aspx","iframekpi.aspx"

Write-Host ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤ IMPORTING LINES ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤
$files = Get-ChildItem $importLocation
foreach ($file in $files) {

    # Prepare cluster endpoint. One for each server/day
    $elasticEndpoint = "http://localhost:9200/iis-" + ($file.Name.ToLower().Substring(0, $file.Name.IndexOf("_"))) + "-" + $fileDate.ToString("yyyyMMdd") + "/entry"

    # Reset index for already imported lines
    try
    {
        $deleteQuery = "http://localhost:9200/iis/entry/_query?q=importSource:" + $file.Name.Replace(".", "_")
        Invoke-RestMethod $deleteQuery -Method "DELETE" | Out-Null
        Invoke-RestMethod $elasticEndpoint -Method "DELETE"
    }
    catch
    {
        Write-Host No index to truncate
    }

    $unicode = New-Object System.Text.UnicodeEncoding
    $utf8 = New-Object System.Text.UTF8Encoding

    try
    {
        $importList = New-Object System.IO.StreamReader($file.FullName, $utf8)
        $line = 0

        while($element = $importList.ReadLine())
        {
            try
            {
                $line = $line + 1
                if ($line -eq 1 -or $line % 10000 -eq 0) {
                	$currentTime = ([System.DateTime]::Now).ToString("yyyy-MM-dd HH:mm:ss")
                    Write-Host $currentTime $file.Name: Importing line $line
                    # Start-Sleep -Milliseconds 500
                }
        
                $shortname = ""
                $path = ""
                $endpoint = "Web"
                
                if ($element.ToString().StartsWith("#")) {
                    continue
                }
        
                $lineItems = $element.ToString().ToLower().Split(" ")
        
                # Fields: date time s-ip cs-method cs-uri-stem cs-uri-query s-port cs-username c-ip cs(User-Agent) cs(Cookie) cs(Referer) sc-status sc-substatus sc-win32-status time-taken
                # 2015-03-04 13:35:25 ::1 GET /tlp_patch_branch - 80 - ::1 Mozilla/5.0+(Windows+NT+6.3;+Win64;+x64)+AppleWebKit/537.36+(KHTML,+like+Gecko)+Chrome/41.0.2272.74+Safari/537.36 LanguageID=1;+projecttotalsviewstate=simple;+projectdetailstate=false;+projecttotalsstate=false;+paymentplantotalsstate=false - 301 0 0 4432
        
                $slashIndex = $lineItems[4].IndexOf("/", 1)
                if ($slashIndex -le 0) {
                    $shortname = $lineItems[4].Trim("/")
                    $path = "/"
                } else {
                    $shortname = $lineItems[4].Substring(1, $slashIndex - 1)
                    $path = $lineItems[4].Replace("/" + $shortname, "")
                }
        
                if ($lineItems[4].Contains(".asmx")) {
                    $endpoint = "ReportingApi"
                } elseif ($lineItems[4].Contains(".svc")) {
                    $endpoint = "TransactionalApi"
                } else {
                    foreach ($skip in $contentList) {
                        if ($lineItems[4].ToLower().EndsWith($skip)) {
                            $endpoint = "Resource"
                        }
                    }
    
                    foreach ($skip in $systemList) {
                        if ($lineItems[4].ToLower().EndsWith($skip)) {
                            $endpoint = "System"
                        }
                    }
                }
        
                $created = Get-Date -Date ($lineItems[0] + " " + $lineItems[1])
        
                $json = "{ ""entry"" : {"
                $json += """created"" : """ + $created.AddHours(0).ToString("yyyy-MM-ddTHH:mm:ss") + """, "
                $json += """path"" : """ + $path.Replace("/", "_").Replace(".", "_").Replace("-", "_").Trim("_") + """, "
                $json += """shortname"" : """ + $shortname + """, "
                $json += """appPool"" : """ + $appPoolList[$shortname] + """, "
                $json += """server"" : """ + $file.Name.Split("_")[0] + """, "
                $json += """customerProductStatus"" : """ + $cpStatusList[$shortname] + """, "
                $json += """statusCode"" : " + $lineItems[11] + ", "
                $json += """endpoint"" : """ + $endpoint + """, "
                $json += """importSource"" : """ + $file.Name.Replace(".", "_") + """, "
                $json += """timeTaken"" : " + $lineItems[14] + ""
                $json += " } }"
        
                Invoke-RestMethod $elasticEndpoint -Method "POST" -ContentType "application/json" -Body "$json" | Out-Null
            }
            catch
            {
                Write-Host Exception in line $line : $_.Exception.Message
            }
        }
    }
    catch
    {
        Write-Host $_.Exception.Message
    }
    finally
    {
        if ($importList -ne $null)
        {
            $importList.Dispose();
        }
    }

    # Move imported file
    $importedDirectory = $file.DirectoryName + "\\imported"
    Move-Item $file.FullName -Destination $importedDirectory

    [GC]::Collect()    
}
```

This script takes a while to run if you have a couple of 100 MB per log file per day per server. I like to make it run overnight and then look at the details in the mornings. I have build a Kibana dashboard for parsing through the data. Elastic supports various ways of searching for the data, but pulling everything into the dashboard in Kibana is straight forward.

I have the following graphs:

-   HTTP status codes count over time
-   Response times over time
-   Request count split on server
-   Request count split on application pools
-   Request count split on content type
-   Top shortnames based on requests
-   Top page requests based on slowest response times
-   Top page requests based on request count

I am using the Chrome extension Postman for doing simple maintenance operations on Elastic and that might be good for another post.

How are you handling Elastic and/or IIS monitoring?
