/*
Copyright 2014 WilhelmW

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: WilhelmW 
  A fork from https://github.com/mlasak/html5rocks-terminal-webinosified
  by Eric Bidelman (ericbidelman@chromium.org)

*/

var util = util || {};
util.toArray = function(list) {
  return Array.prototype.slice.call(list || [], 0);
};

// Cross-browser impl to get document's height.
util.getDocHeight = function() {
  var d = document;
  return Math.max(
      Math.max(d.body.scrollHeight, d.documentElement.scrollHeight),
      Math.max(d.body.offsetHeight, d.documentElement.offsetHeight),
      Math.max(d.body.clientHeight, d.documentElement.clientHeight)
  );
};

var Terminal = Terminal || function(containerId) {
  const VERSION_ = '2.1.0';
  const ROOTURL_ = 'http://wilhelmw.de';
  const GITHUB_ = 'https://github.com/WilhelmW-DE';
  const CMDS_ = ['cat', 'cd', 'clear', 'date', 'help', 'history', 'ls', 'pwd', 'version', 'who', 'wget', 'github'];
  const FILES_ = {
        '/tmp' : {
          'gesetzgebung.pl.txt' : ''
        },
        '/programme': {
          '/countdown' : {
            'setup.exe' : ''
          },
          '/dateienfilter' : {
            'setup.exe' : ''
          },
          '/wortzaehler' : {
            'setup.exe' : ''
          }
        },
        'version_history' : ''
      };

  var fs_ = null;
  var cwd_ = '/';
  
  var history_ = [];
  var histpos_ = 0;
  var histtemp_ = 0;
  
  var tabcount_ = 0;
  var tab_ = [];
  var tabtemp_ = '';

  var timer_ = null;

  var fsn_ = null;
  
  // Create terminal and cache DOM nodes;
  var container_ = document.getElementById(containerId);
  container_.insertAdjacentHTML('beforeEnd',
      ['<output></output>',
       '<div id="input-line" class="input-line">',
       '<div class="prompt"></div><div><span class="cursor hidden">&nbsp;</span><input class="cmdline" autofocus /></div>',
       '</div>'].join(''));  
  var inputline_ = container_.querySelector('#input-line');
  var prompt_ = container_.querySelector('#input-line .prompt');
  var cmdLine_ = container_.querySelector('#input-line .cmdline');  
  var cursor_ = container_.querySelector('#input-line .cursor');
  var output_ = container_.querySelector('output');
  var interlace_ = document.querySelector('.interlace');
  
  // Set prompt
  refreshPrompt();

  output_.addEventListener('click', function(e) {
    var el = e.target;
    if (el.classList.contains('file') || el.classList.contains('folder')) {
      cmdLine_.value += ' ' + el.textContent;
    }
  }, false);

  window.addEventListener('click', function(e) {
    //if (!document.body.classList.contains('offscreen')) {
      cmdLine_.focus();
    //}
  }, false);

  // Always force text cursor to end of input line.
  cmdLine_.addEventListener('click', inputTextClick_, false);

  // Handle up/down key presses for shell history and enter for new command.
  cmdLine_.addEventListener('keydown', keyboardShortcutHandler_, false);
  cmdLine_.addEventListener('keyup', historyHandler_, false); // keyup needed for input blinker to appear at end of input.  
  cmdLine_.addEventListener('keydown', refreshCursor, false);
  cmdLine_.addEventListener('keydown', processNewCommand_, false);

  function inputTextClick_(e) {
    this.value = this.value;
  }

  function keyboardShortcutHandler_(e) {
    // crtl+s example
    //if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) { // crtl+s}
      
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 67) { // crtl+c
      this.value += '^C'; 
         
      // Duplicate current input and append to output section.
      var line = this.parentNode.parentNode.cloneNode(true);
      line.removeAttribute('id');
      line.classList.add('line');
      line.querySelector('input.cmdline').parentNode.removeChild(line.querySelector('span.cursor'));
      var input = line.querySelector('input.cmdline');
      input.autofocus = false;
      input.readOnly = true;
      output_.appendChild(line);
      
      this.value = '';
    }
  }

  function selectFile_(el) {
    //alert(el)
  }
  
  function historyHandler_(e) { // Tab needs to be keydown.

    if (history_.length) {
      if (e.keyCode == 38 || e.keyCode == 40) {
        if (history_[histpos_]) {
          history_[histpos_] = this.value;
        } else {
          histtemp_ = this.value;
        }
      }

      if (e.keyCode == 38) { // up
        histpos_--;
        if (histpos_ < 0) {
          histpos_ = 0;
        }
      } else if (e.keyCode == 40) { // down
        histpos_++;
        if (histpos_ > history_.length) {
          histpos_ = history_.length;
        }
      }

      if (e.keyCode == 38 || e.keyCode == 40) {
        this.value = history_[histpos_] ? history_[histpos_] : histtemp_;
        this.value = this.value; // Sets cursor to end of input.
      }
    }
    
  }

  function processNewCommand_(e) {

    // Beep on backspace and no value on command line.
    if (!this.value && e.keyCode == 8) {
      return;
    }

    if (e.keyCode == 9) { // Tab
      e.preventDefault();
	  
	  var cmd = this.value;
	  var patt = new RegExp("^" + cmd + ".*", 'i');
	  
	  if(tabcount_ == 0) {
		  tab_ = [];
		  CMDS_.forEach( function(comand) {  
			if(patt.test(comand)) {
				tab_[tab_.length] = comand;
			}
		  });
	  }
	  
	  if(tab_.length == 1) {
		  cmdLine_.value = tab_[0];
	  }
	  
	  if(tabcount_ == 1) {
		  
		  // Duplicate current input and append to output section.
		  newprompt_();
		  
		  // hide prompt until cmd is done
		  inputline_.classList.add('hidden');
		  
          output('<div class="ls-files">' + tab_.join('<br />') + '</div>');
		  
          cmddone_();
	  }
	  
	  tabcount_++;
      // TODO(ericbidelman): Implement tab suggest.
	} else {
	  tabcount_ = 0;
	}
	
	if (e.keyCode == 13) { // enter

      // Save shell history.
      if (this.value) {
        history_[history_.length] = this.value;
        histpos_ = history_.length;
      }

      // Duplicate current input and append to output section.
      newprompt_();
      
      // hide prompt until cmd is done
      inputline_.classList.add('hidden');

      // Parse out command, args, and trim off whitespace.
      // TODO(ericbidelman): Support multiple comma separated commands.
      if (this.value && this.value.trim()) {
        var args = this.value.split(' ').filter(function(val, i) {
          return val;
        });
        var cmd = args[0].toLowerCase();
        args = args.splice(1); // Remove cmd from arg list.
      }

      switch (cmd) {
        case 'cat':
          var filepath = args.join(' ');

          if (!filepath) {
            output('usage: ' + cmd + ' filename');  
            cmddone_();
            break;
          }

          filepath = getPath(filepath);
          filename = filepath.split('/').pop();
          
          var entries = getDir(filepath);
          if(entries) {
            if(entries == filename) {
              getFile(filepath, function(result) {
                output('<pre>' + result + '</pre>');
                cmddone_();
              });
              
            } else {
              output(cmd+': '+filepath+': Is a directory<br>');   
              cmddone_();
            }
          } else {
            output(cmd+': '+filepath+': No such file or directory<br>');   
            cmddone_();
          }
          break;
        case 'clear':
          clear_(this);   
          cmddone_();
          return;
        case 'date':
          output((new Date()).toLocaleString());  
          cmddone_();
          break;
        case 'exit':  
          cmddone_();
          break;
        case 'help':
          output('<div class="ls-files">' + CMDS_.join('<br>') + '</div>');
          cmddone_();
          break; 
        case 'history':
          for(var i=0; i < history_.length; ++i) {
            var blanks = Array(Math.floor(history_.length / 10) - Math.floor((i+1) / 10) + 2).join('&nbsp;');   
            output(blanks + (i+1) + '&nbsp;&nbsp;' + history_[i] + '<br />');
          }
          cmddone_();
          break;
        case 'ls':
          ls_(args);  
          cmddone_();
          break;
        case 'pwd':
          output(cwd_);   
          cmddone_();
          break;
        case 'cd':
          var dest = args.join(' ') || '/';
          cd_(dest);  
          cmddone_();       
          break;
        case 'sudo':
          output("Nice Try...");  
          cmddone_();
          break;
        case 'version':
        case 'ver':
          output(VERSION_);
          cmddone_();
          break;
        case 'wget':
			if(!args[0]) {
				output('wget: URL missing<br />');
				output('Syntax: wget [URL]...');
				cmddone_();
				break;
			}
			var url = getPath(args[0]);

			var entries = getDir(url);
			if(entries) {
			window.open(ROOTURL_ + url, 'Download');
			} else {
			output(cmd+': '+url+': No such file or directory<br />');
			}
			cmddone_();
			break;
        case 'who':      
          output('HTML5 Terminal Website on <a href="https://github.com/WilhelmW-DE/html5-terminal-website" target="_blank">GitHub</a><br />');
          output('By: WilhelmW &lt;wilhelm@wilhelmw.de&gt;<br />');      
          output('V1.0.0 Terminal.js By: Eric Bidelman &lt;ericbidelman@chromium.org&gt;<br />');
          cmddone_();
          break;
		case 'github':
		  output('<a href="' + GITHUB_ + '">' + GITHUB_ + '</a>');
		  cmddone_();
		  break;
        default:
          if (cmd) {
            output(cmd + ': command not found');
          }      
          cmddone_();
      };

      this.value = ''; // Clear/setup line for next input.
    }
  }
  
  function cmddone_() {
    inputline_.classList.remove('hidden'); // show prompt again       
    cmdLine_.focus();
  }
  
	function newprompt_() {
		// Duplicate current input and append to output section.
		var line = cmdLine_.parentNode.parentNode.cloneNode(true);
		line.removeAttribute('id');
		line.classList.add('line');
		line.querySelector('input.cmdline').parentNode.removeChild(line.querySelector('span.cursor'));
		var input = line.querySelector('input.cmdline');
		input.autofocus = false;
		input.readOnly = true;
		output_.appendChild(line);
	}

  function formatColumns_(entries) {
    var maxName = entries[0];
    entries.forEach(function(entry, i) {
      if (entry.length > maxName.length) {
        maxName = entry;
      }
    });

    // If we have 3 or less entries, shorten the output container's height.
    // 15px height with a monospace font-size of ~12px;
    var height = entries.length == 1 ? 'height: ' + (entries.length * 30) + 'px;' :
                 entries.length <= 3 ? 'height: ' + (entries.length * 18) + 'px;' : '';
    height = '';
    
    // ~12px monospace font yields ~8px screen width.
    var colWidth = maxName.length * 16;//;8;

    return ['<div class="ls-files" style="-webkit-column-width:', colWidth, 'px;', height, '">'];
  }
  
  function cd_(dest) {
    var dir = getPath(dest);
    var entries = getDir(dir);
    if(entries) {
      cwd_ = dir;
      refreshPrompt();
    } else {
      output('cd: '+dest+': No such file or directory<br>');
    }
  }

  function ls_(args) {
    var entries = getDir(cwd_);
    
    if (entries.length) {
      var html = formatColumns_(entries);
      for (var i = 0; i < entries.length; ++i) {
        if(entries[i].charAt(0) == '/') {    
          html.push('<span class="folder">', entries[i].substr(1), '</span><br />');
        } else {
          html.push('<span class="file">', entries[i], '</span><br />');
        }
      }
      html.push('</div>');
      output(html.join(''));
    }
  }

  function clear_(input) {
    output_.innerHTML = '';
    input.value = '';
    document.documentElement.style.height = '100%';
    interlace_.style.height = '100%';
  }

  function output(html) {
    output_.insertAdjacentHTML('beforeEnd', html);
    cmdLine_.scrollIntoView();
  }
    
  function refreshPrompt() {
    prompt_.innerHTML = 'guest@'+document.title+':'+cwd_+'# ';
  }
      
  /////////////////////////////////////////////////////////////////////////////
  function refreshCursor(e) {
    cursor_.style.left = (10 + this.value.length * cursor_.offsetWidth) + 'px';
  }
     
  /////////////////////////////////////////////////////////////////////////////
  function getDir(path) {      
    var entries = FILES_; 
    var dirs = path.split('/');
    dirs.shift();
    while(path != '/' && dirs.length > 0) {
      var dir = dirs.shift();
      // dir
      if('/'+dir in entries) {
        entries = entries['/'+dir];
      // file
      } else if(dir in entries) {
        entries = {};
        entries[dir] = '';
      } else {
        entries = undefined;
        break;
      }
    }
    if(entries) {                
      entries = Object.keys(entries);
    }
    
    return entries;  
  }
      
  /////////////////////////////////////////////////////////////////////////////
  function getFile(path, doneCallback) {
    var xhr;
    if (window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xhr.onreadystatechange = handleStateChange;
    xhr.open("GET", ROOTURL_ + path, true);
    xhr.send();
    
    function handleStateChange() {
        if (xhr.readyState === 4) {
            doneCallback(xhr.status == 200 ? xhr.responseText : 'Unknown Error: Status '+xhr.status);
        }
    }
  }
  
  /////////////////////////////////////////////////////////////////////////////
  function getPath(path) {
    // relative to absolute path
    if(path.charAt(0) != '/') {
      if(cwd_.length == 1) { 
        path = '/' + path;
      } else {
        path = cwd_ + '/' + path;
      }
    }
    
    // remove .. & .
    var stack = new Array();
    var parts = path.split("/");
    for (var i=0; i<parts.length; i++) {
        if (parts[i] == ".")
            continue;
        if (parts[i] == "..")
            stack.pop();
        else
            stack.push(parts[i]);
    }
    
    path = stack.join("/");
    
    // leere Pfade vermeiden
    if(path == "") {
      path = '/'
    }
    
    return path;
  }

  return {
    init: function() {
      output('<div>Welcome to ' + document.title +
             '! (v' + VERSION_ + ')</div>');
      output((new Date()).toLocaleString());
      output('<p>Documentation: type "help"</p>');
      
    },
    output: output,
    getCmdLine: function() { return cmdLine_; },
    selectFile: selectFile_
  }
};

