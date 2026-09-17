---
title: "Running Jekyll on Ubuntu on Windows"
description: "Last year, I moved my site to use Jekyll and hosted it on Github pages. It works really well, but it took me several attempts to actually run the compilation…"
pubDate: "2017-01-22"
permalink: "2017/01/22/running-jekyll-on-ubuntu-on-windows"
---
Last year, I moved my site to use Jekyll and hosted it on Github pages. It works really well, but it took me several attempts to actually run the compilation and serving on my Windows machine. It sounds like a simple task, after all entering development mode in Windows 10 and installling the Linux subsystem should allow easier access to libraries normally only easily available for Linux users. However, I have had issues installing the jekyll bundle every time I have tried on a new PC. This time, I have had similar issues, so I decided to note down the links and resources I have used – if nothing else, then just for next time I have to do it myself.

## Getting started

[Jekyll on Bash on Ubuntu on Windows](http://daverupert.com/2016/04/jekyll-on-windows-with-bash/]) has been my goto guide this time and combined with this [Install Jekyll 2 on Ubuntu 14.04](http://michaelchelen.net/81fa/install-jekyll-2-ubuntu-14-04/). Just for reference, I have copied part of the commands to this page. [The official Microsoft reference for installing](https://msdn.microsoft.com/en-us/commandline/wsl/install_guide).

1.  In Windows 10 > Settings > Updates & Security > For developers > Check “Developer Mode”
2.  Open “Windows Features” > Check “Windows Subsystem for Linux”. Restart.
3.  From the run dialog, run “bash”
4.  Run the following commands:

```
$ sudo -s
$ apt update
$ apt install make gcc
$ apt-add-repository ppa:brightbox/ruby-ng
$ apt update
$ apt install ruby2.3 ruby2.3-dev ruby-switch
$ ruby -v
$ ruby-switch --set ruby2.3
$ gem install jekyll
```

## Various install issues

I got some pointers from the general install guide from the [official install guide of nokogiri](http://www.nokogiri.org/tutorials/installing_nokogiri.html).

```
Building nokogiri using system libraries.
libxml2 version 2.6.21 or later is required!
*** extconf.rb failed ***
```

Solution ([reference](https://github.com/sparklemotion/nokogiri/issues/1099)): bundle config build.nokogiri –use-system-libraries –with-xml2-include=/usr/local/opt/libxml2/include/libxml2

```
/var/lib/gems/2.3.0/gems/bundler-1.14.1/lib/bundler/runtime.rb:40:in 'block in setup': You have already activated addressable 2.5.0, but your Gemfile requires addressable 2.4.0. Prepending `bundle exec` to your command may solve this. (Gem::LoadError)

or

jekyll 3.0.5 | Error:  Invalid argument - Failed to watch "/mnt/c/Projects/Oexenhave/.git/hooks": the given event mask contains no legal events; or fd is not an inotify file descriptor.
```

Solution ([reference](https://github.com/jekyll/jekyll/issues/5233)): bundle exec jekyll serve – -force\_polling
