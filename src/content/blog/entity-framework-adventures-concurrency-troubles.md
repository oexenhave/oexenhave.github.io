---
title: "Entity Framework Adventures – Concurrency Troubles"
description: "I’m building a new project to automate various DevOps tasks, I decided to go for Entity Framework as handling the database. I have a standard SSDT project fo…"
pubDate: "2016-10-31"
permalink: "2016/10/31/entity-framework-adventures-concurrency-troubles"
---
I’m building a new project to automate various DevOps tasks, I decided to go for Entity Framework as handling the database. I have a standard SSDT project for the actual database structure, but in the service-project the code part of it is through an EDMX file. Out of the box, the T4 template generates data classes and a class inheriting from DbContext. No news here. I also decided to go for Autofac for dependency injection and wire up the whole thing. It should be a straight forward task and many blog posts are available for making this happen. However, I ran into some non-trivial issues when I added a few extra background threads to the mix.

The idea behind the application is to handle daily routines like patching and provisioning new sites in a seemingly old-school application server provider model aka. each customer has its own virtual IIS site and database. A silo structure. This structure has benefits and drawbacks. The main drawback is that it makes it a bit more cumbersome to for example update all of them with a new patch or provide the necessary tools for developers to access and debug production data. This is where this application has its place. Its construction and various innerworkings would be interesting for another write up.

Anyway, the jobs need to run in the background so a few extra threads need be spun up. The most used ways setting the DbContext up does not work for multithreading scenarios where they are not all tied directly to a IIS request thread (InstancePerLifetimeScope) – or at least that’s the combinations I have found. The go to guide for the various usages of the DbContext would be the blog post “Managing DbContext the right way with Entity Framework 6: an in-depth guide” by Mehdi El Gueddari.

The solution, I ended up with was to instantiate the DbContext in a using construct as often as necessary. Even multiple times in the same request. Creating the same instance again and again is that efficient? Apparently for this object it is according to [How to decide on a lifetime for your ObjectContext](https://blogs.msdn.microsoft.com/alexj/2009/05/07/tip-18-how-to-decide-on-a-lifetime-for-your-objectcontext/). No worries. I wanted to have a custom setup of the connection string and lazy loading settings, so I ended up constructing a partial class that handles the instance creation like below:

```
public partial class TCAMEntities
{
    public TCAMEntities(DbConnection nameOrConnectionString) : base(nameOrConnectionString, true) 
    {
    }

    public static TCAMEntities Instance
    {
        get
        {
            EntityConnectionStringBuilder _entityBuilder = new EntityConnectionStringBuilder
            {
                Provider = "System.Data.SqlClient",
                // E.g. data source=localhost;initial catalog=tcam;persist security info=True;user id=sa;password=sa;multipleactiveresultsets=True;application name=EntityFramework
                ProviderConnectionString = MachineConfigurationManager.AppSettings["ConnectionString"],
                Metadata = @"res://*/DAL.TCAMModel.csdl|res://*/DAL.TCAMModel.ssdl|res://*/DAL.TCAMModel.msl"
            };

            var _result = new TCAMEntities(new EntityConnection(_entityBuilder.ToString()));
            _result.Configuration.LazyLoadingEnabled = false;
            return _result;
        }
    }
}
```

And it simplifies the actual usage to a setup like:

```
public IEnumerable<IClientView> GetAll()
{
    using (var _entities = TCAMEntities.Instance)
    {
        return _entities.Clients.Where(c => c.IsActive).Select(Convert).ToArray();
    }
}
```

However, the drawback is that in some situations the nature of EF would lazy load stuff, but as the context is disposed that’s not possible. To get around it, I use ToArray() or similar. The upside is that I don’t by accident lazy load all kinds of stuff in controllers.

This works reasonable well for the current load of the application. I have one place where I execute two ajax calls at the same time targeting the same table, this gives deadlock issues. Therefore, I implemented a simple lock for that call for now.

In case you wonder, the [MachineConfigurationManager](https://gist.github.com/oexenhave/6502176cb2987632896342ec03d64f2f) class is a custom class that generates a machine specific config file that can be ignored when committing, but still falls back to web.config for debug values.
