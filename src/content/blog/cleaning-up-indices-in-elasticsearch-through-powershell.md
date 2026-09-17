---
title: "Cleaning up indices in ElasticSearch through Powershell"
description: "If you, like TimeLog, are running an Elastic cluster gathering all kinds of data point for analysis of user behavior, server health and performance logs, aud…"
pubDate: "2019-09-26"
permalink: "2019/09/26/cleaning-up-indices-in-elasticsearch-through-powershell"
---
If you, like [TimeLog](https://www.timelog.com), are running an Elastic cluster gathering all kinds of data point for analysis of user behavior, server health and performance logs, audit logs for GDPR requirements or other logs you will at some point have to make a decision on whether to keep increasing the storage to accommodate the data points or create a retention policy to get rid of old data.

In the beginning it have worked for us to setup alerts when space is getting low and the using the API to manually delete old months, but as our Elastic cluster becomes a first class citizen in our IT infrastructure and strategy, we need to automate and follow stricter processes for ensuring up-time and data availability based on business demands. TimeLog hosts the Elastic cluster in AWS and (for now) we are only using it for log data for analysis. This means that we only store time series data and all of our indices will at some point be old enough to delete them all together.

I took a decision early in the adoption of the [ELK stack](https://www.elastic.co/what-is/elk-stack), to name the indices with a named prefix and a date post-fix to easily identify those indices that could be deleted. Example of our indices are therefore: “iis-20190926”, “metricbeat-20190924” etc.

With the standard Elastic API, I can easily query the list of indices and delete those of a certain month.

```
GET {elastic_url}/iis-*/_stats
DELETE {elastic_url}/iis-201906*
```

However, having to keep monitoring the storage requirements before it is too late. And trust me, you don’t want to max out the storage. I ended up creating a completely new Elastic cluster and migrating to that, because I failed to believe that after over 24 hours of “reconfiguration…” status in AWS trying to add more storage that this would ever work. It did eventually, but by that time I already migrated. In any case, I have setup the following alarms in AWS CloudWatch:

```
FreeStorageSpace <= 2500 for 3 datapoints within 15 minutes
ClusterIndexWritesBlocked >= 1 for 1 datapoints within 5 minutes
JVMMemoryPressure >= 80 for 3 datapoints within 15 minutes
ClusterStatus.red >= 1 for 1 datapoints within 5 minutes
CPUUtilization >= 80 for 3 datapoints within 15 minutes
```

I put together that set of alarms following the [recommendations from Amazon](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/cloudwatch-alarms.html).

But enough about the general setup, I wanted to automate the clean up. First I looked closer at [Curator](https://www.elastic.co/guide/en/elasticsearch/client/curator/current/index.html) to figure out if that was a good fit for me. But for the time being it wasn’t, the step into Python and AWS Lambda was not a route I wanted to pursue. Instead I did a fall back to Powershell. The idea: Define a function where I can provide the prefix and the days to keep indices and then it will look up all the indices with a specific prefix, then parse the date in the name and delete based on that. This is the script I ended up with:

```powershell
$elasticUrl = "https://*.es.amazonaws.com"
$today = Get-Date

Function CleanElasticIndices($prefix, $daysToKeep) {

    $listIndicesUrl = ($elasticUrl + "/" + $prefix + "-*/_stats")

    Write-Host ("Fetching data from: " + $listIndicesUrl)

    $jsonIndices = Invoke-WebRequest -Method Get -Uri $listIndicesUrl -UseBasicParsing | ConvertFrom-Json

    $indicesKept = 0
    foreach ($index in $jsonIndices.indices.PSObject.Properties) {
        
        $indexDateString = $index.Name.Substring($prefix.Length + 1, $index.Name.Length - $prefix.Length - 1)

        [datetime]$indexDate = New-Object DateTime
        if ([DateTime]::TryParseExact(  $indexDateString, 
                                        "yyyyMMdd", 
                                        [System.Globalization.CultureInfo]::InvariantCulture,
                                        [System.Globalization.DateTimeStyles]::None,
                                        [ref]$indexDate)) {
            if ($indexDate -le $today.AddDays(-$daysToKeep)) {
                Write-Host ("Examining the index: " + $index.Name + " => " + $indexDate.ToShortDateString() + " => Attempting delete... ") -NoNewline
                $indiceDeleteUrl = ($elasticUrl + "/" + $index.Name)
                $deleteResult = Invoke-WebRequest -Method Delete -Uri $indiceDeleteUrl -UseBasicParsing
                Write-Host $deleteResult

                Start-Sleep -Seconds 2
            } else {
                Write-Host ("Examining the index: " + $index.Name + " => " + $indexDate.ToShortDateString() + " => keep")
                $indicesKept = $indicesKept + 1
            }
        }
    }

    Write-Host ($indicesKept.ToString() + " """ + $prefix + """ indices kept on Elastic")
}

CleanElasticIndices "iis" (18 * 7) # 18 weeks
CleanElasticIndices "metricbeat" (2 * 7) # 2 weeks
```

Add it to a scheduled task on a Windows box executing every day then you are good. Until the daily volume increases to a level to make the AWS CloudWatch alarms to go off again. Then you are back to the initial question: Increase storage or reduce data retention?

I started our Elastic cluster as a proof of concept that now have turned into production use. On that journey, I have taken the time to define the definition of each index type and the related retention policy. Each the indices are defined with:

-   Index name (the prefix)
-   Friendly name
-   Description (business value)
-   Retention policy (in weeks)
-   Estimated number of entries per day
-   Estimated size increase per day

The estimations will allow you to bridge over to the money aspect and only argue about long term retention on indices with high daily storage demand. All in all, it makes it easier to communicate to the leadership team the value it brings, hence ensure funding. Assuming that you are actually using the cluster for something delivering business value in the first place 🙂
