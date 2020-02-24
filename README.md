# Table Of Contents
* [ Introduction ](#intro)
* [ Requirements ](#req)
* [ Step by step guide](#guideStart)
    * [ Install the required tooling ](#install)
    * [ Create the Atlassian plugin / App ](#createPlugin)
    * [ Create and prepare the Angular project](#angularCreate)
    * [ Modify the plugin to use the Angular project](#preparePlugin)
    * [ Take the plugin for a spin](#start)
* [ BONUS: Use aui for your dev client ](#bonus)
---
<a name="intro"></a>
## Introduction
This guide shows how to integrate Angular into a Project-centric Jira-plugin respectively Jira app. This guide can also be used to integrate Angular into Confluence, you just need to modify the web-item and the web-panel to do so. The core Idea is to separate your client from your plugin and build each one seperatly. We will do this by using the frontend-maven-plugin and bypassing the integrated yui-compressor, which Atlassian plugins normally would use to compress and minify your frontend resources. Then we need to make some small adjustments to the Angular project, so everything works quite nicely together. I would also highly recommend to separate your client from your backend code. The client should only talk to the backend via your plugins Rest-Api!

---
<a name="req"></a>
## Requirements
For this to work you need the following things:
* Java (a version, which is compatible with the atlassian-plugin SDK. We use java 8 for this tutorial)
* Node (a version, which is compatible with the angular CLI. We use Node 12.8.1 for this tutorial)
* Git (Optional)
* The Atlassian plugin SDK. You can find installation instructions for the SDK at: [developer.atlassian.com](https://developer.atlassian.com/server/framework/atlassian-sdk/set-up-the-atlassian-plugin-sdk-and-build-a-project/)
* The Angular CLI. You can find installation instructions for the CLI at: [cli.angular.io](https://cli.angular.io/)
* For IDEs I would recommend using [VSCode](https://code.visualstudio.com/) and [IntelliJ Idea Community Edition](https://www.jetbrains.com/idea/)
* You should also have a bit of knowledge about Jira plugin / Jira app development and Angular development.

---
<a name="guideStart"></a>
## Step by Step Guide
The following points describe all the things you need to do, in order to integrate Angular in an Atlassian plugin.

---
<a name="install"></a>
### Install the required Tooling
The first step, if you haven't done that already, is to install all the required tools. This includes Java, Node, the Atlassian plugin SDK and the Angular CLI. You can find links to download them in the [Requirements](#reg) section of this guide.

---
<a name="createPlugin"></a>
### Create the Atlassian plugin
The first thing you need to do is to create the Atlassian plugin skeleton. This guide focus on a Jira plugin, but it can also be used for creating a Confluence plugin. You have to substitute the Jira commands with the Confluence counterparts.

You can create a Jira plugin skeleton with
```
atlas-create-jira-plugin
```
After that you get a bunch of questions, which are needed for the plugin. For this guide, we will choose the following values:
```
- groupId: com.scitotec
- artifactId: angularInJira
- version: [enter]
- package: [enter]
- confirm: [enter]
```
Then we `cd angularInJira` to change the directory to the newly created plugin. If you choose to use Git, you can type `git init` and a new local repository will be created.

---
<a name="angularCreate"></a>
### Create and prepare the Angular project
#### Creating the project
We will use the Angular CLI to create a new Angular project.
```
ng new client --skipGit=true
```
We choose to skip Git, because we don't want a repo only for our client but you could do that in your project. We just don't do it for this guide. Just like the Atlassian SDK we are asked some questions about our project.
```
- Routing: No
- Stylesheet: You can choose whatever you like, I choose SCSS
```
When the CLI is done, the next step is to modify the `angular.json`. We need to change the Output Path and the Output Hashing Method.
#### Modify angular.json
First we change the "`outputPath`" to "`../target/classes/client`"
```json
[...]
"architect": {
    "build": {
        "builder": "@angular-devkit/build-angular:browser",
        "options": {
            "outputPath": "../target/classes/client",
            "index": "src/index.html",
            "main": "src/main.ts",
[...]
```
Then we change the "`outputHashing`" to "`none`" so we have an easier time to define our web-resource for the Jira plugin / Jira app
```json
[...]
"configurations": {
    "production": {
        "fileReplacements": [{
            "replace": "src/environments/environment.ts",
            "with": "src/environments/environment.prod.ts"
        }],
        "optimization": true,
        "outputHashing": "none",
[...]
```
#### Move the loading of zone.js
Now the first tricky part comes in. Because Angular uses zone.js for change detection, there are some problems we need to resolve. The first one is, that zone.js does not like when the global promise object is overwritten after zone has loaded. If we do not change the standard Angular behaviour zone.js will just complain and Angular refuses to work. To prevent that, we need to change the timing, when zone.js is actually loaded. In a standard Angular project zone.js is loaded within the polyfills and is registered immediatly on page load. What we want is, that it gets loaded, when it is actually needed for the first time and that is while bootstrapping our application. So we remove the zone.js import statment from the `polyfills.ts` and move it to the `main.ts`. The resulting files should look something similiar to this:

`polyfills.ts`
```js
[...]
/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
// import 'zone.js/dist/zone';
/***************************************************************************************************
```
`main.ts`
```ts
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import 'zone.js/dist/zone'; //We move the Import to this place
[...]
```
#### Change the way we bootstrap the Angular app in production mode
Now that we have that out of the way, we can address the other problem which arises. By taking into account how Jira and Confluence process there JavaScript resources and the templates, we need to develop a strategy, that our root Angular element is really there in the DOM tree or else we will get an error while bootstrapping our Angular app. We will use the Atlassian JavaScript library (AJS) to accomplish this task. First we declare AJS as given, so the typescript compiler won't complain if we use the functionality of it
```ts
declare var AJS: any;
```
Then we move the bootstrap logic into a separate function
```ts
const bootstrap = () => {
  platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch(err => console.error(err));
};
```
Now we need to differentiate, if we are in production mode or use `ng serve` to view the app. When we are not in production mode, we can just bootstrap the app like normal
```ts
if (!environment.production) {
  bootstrap();
}
```
But if we are in production mode, we use AJS to determine when everything is loaded and then we bootstrap our app. We will use the function `AJS.toInit()` for this, which takes another function as argument and executes it when everything is ready.
```ts
if (environment.production) {
  enableProdMode(); //this comes from angular
  AJS.toInit(() => {
    bootstrap();
  });
}
```

So the whole `main.ts` file would look something like this

<details>
<summary>main.ts</summary>

```ts
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import 'zone.js/dist/zone';

declare var AJS: any;
const bootstrap = () => {
platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch(err => console.error(err));
};

if (environment.production) {
  enableProdMode();
  AJS.toInit(() => {
    bootstrap();
  });
} else {
  bootstrap();
}
```
</details>

#### Testing with Karma
Next I would like to take the time and also configure our testing framework `karma` but you could skip this steps if you don't like to test your code, which you absolutely shouldn't do. At first we will install Pupeteer for testing, so whoever builds the Atlassian plugin doesn't need Chrome installed.
```bash
npm install --save-dev puppeteer @types/puppeteer
```
After we executed this command and npm has installed all the packages, we need to slightly modify the `karma.conf.js` configuration file. We need to do 3 things there. First we need to use Pupeteer as the Chrome binary, if none is set. Second we add a custom launcher for Pupeteer Chrome and lastly we tell Karma to use that custom launcher. So the configuration file looks like this:

<details>
<summary>karma.conf.js</summary>

```js
if (!process.env.CHROME_BIN) {
  console.info('No CHROME_BIN is set, falling back to puppeteer chrome.');
  process.env.CHROME_BIN = require('puppeteer').executablePath();
}
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false
    },
    customLaunchers: {
      ChromeOrPuppeteer: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, './coverage/client'),
      reports: ['html', 'lcovonly', 'text-summary'],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: false,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeOrPuppeteer'],
    singleRun: true,
    restartOnFileChange: false
  });
};
```
</details>

Because zone.js is not longer loaded in the polyfills, we also have to import it in the test.ts file
```ts
import 'zone.js/dist/zone';
import 'zone.js/dist/zone-testing';
import { getTestBed } from '@angular/core/testing';
[...]
```

#### Change the actual app component into a simple counter
To show that everything is working inside Jira, we will replace the `app.component.html`, `app.component.ts`, `app.module.ts` and `app.component.spec.ts` with something a bit more practical. We will implement a simple counter. Two buttons and a input field. We will also display the current Angular version in our template. This is just a very very simple Angular component. If you don't know what these things do, you should check out the [ angular Starter Guide ](https://angular.io/start)

<details>
<summary>app.compontent.html</summary>

```html
<div class="aui-item">
    <h1>We use Angular now!</h1>
</div>
<div class="aui-item">
    <h2>Angular version: {{angularVersion}}</h2>
</div>
<form class="aui">
  <div class="field-group">
    <label for="counter">Counter
      <span class="aui-icon icon-required">(required)</span></label>
    <input class="text medium-field" type="number" id="counter" name="counter" [(ngModel)]="counter">
    <div class="description">A simple counter</div>
  </div>
  <div class="buttons-container">
    <div class="buttons">
      <button type="button" class="aui-button" (click)="inc()">Increment</button>
      <button type="button" class="aui-button" (click)="dec()">Decrement</button>
    </div>
  </div>
</form>
```
</details>
<details>
<summary>app.component.ts</summary>

```ts
import { Component } from '@angular/core';
import { VERSION } from '@angular/core';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public counter = 0;
  get angularVersion(): string {
    return VERSION.full;
  }
  inc() {
    this.counter++;
  }
  dec() {
    this.counter--;
  }
}
```
</details>

<details>
<summary>app.component.spec.ts</summary>

```ts
import { TestBed, async } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
      ],
      declarations: [
        AppComponent
      ],
    }).compileComponents();
  }));
  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });
});
```
</details>

<details>
<summary>app.module.ts</summary>

```ts
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```
</details>

#### Check if everything still works
After we have done all the steps, we should be able to fire up `ng serve`, naviage with a browser of our choice to the address `http://localhost:4200` and see our counter in action. Don't worry about the design of the app. All CSS-Styles are applied, when the page is viewed within Jira or Confluence.

---
<a name="preparePlugin"></a>
## Modify the Plugin to use the Angular Project
In this part of the guide, we will modify the plugin files, to integrated our Angular app into a Jira web-panel, which will be displayed in the project-centric view. To achieve this, we need to modify the `pom.xml`, the `atlassian-plugin.xml` and create a template, which holds our angular root component.

ATTENTION:
> It is of utmost importance, that you use the maven bin which is shipped with the Atlassian SDK to build the project. You have to configure your IDE for that, or else a lot of things wont work as expected.

#### Modify the pom.xml
We need to make 2 changes to this file: Add the frontend-maven-plugin and update the Jira version to something newer. While writing the guide the current Jira version was `8.6.0` so we will use that. For that we just need to modify the Jira version property at the end of the file:
```xml
<jira.version>8.6.0</jira.version>
``` 
Now we add the frontend maven plugin. We add the plugin to our build configuration in the pom.xml. We basically tell Maven to download and install a local Node and npm version, install all the required dependencies, run the test and build scripts from the package.json
<details>
<summary>pom.xml</summary>

```xml
[...]
<build>
    <plugins>
        <plugin>
            <groupId>com.github.eirslett</groupId>
            <artifactId>frontend-maven-plugin</artifactId>
            <version>1.8.0</version>
            <executions>
                <execution>
                    <id>install node and npm</id>
                    <goals>
                        <goal>install-node-and-npm</goal>
                    </goals>
                    <phase>generate-resources</phase>
                </execution>
                <execution>
                    <id>npm install</id>
                    <goals>
                        <goal>npm</goal>
                    </goals>
                    <phase>generate-resources</phase>
                    <configuration>
                        <arguments>install</arguments>
                    </configuration>
                </execution>
                <execution>
                    <id>client tests</id>
                    <goals>
                        <goal>npm</goal>
                    </goals>
                    <phase>test</phase>
                    <configuration>
                        <arguments>run-script test</arguments>
                    </configuration>
                </execution>
                <execution>
                    <id>prod</id>
                    <goals>
                        <goal>npm</goal>
                    </goals>
                    <configuration>
                        <arguments>run-script build -- --prod</arguments>
                    </configuration>
                    <phase>generate-resources</phase>
                </execution>
            </executions>
            <configuration>
                <nodeVersion>v12.8.1</nodeVersion>
                <npmVersion>6.10.2</npmVersion>
                <workingDirectory>client</workingDirectory>
            </configuration>
        </plugin>
[...]
```
</details>

#### Modify the atlassian-plugin.xml
Before we start changing the plugin.xml, we can safely delete the js and css folders inside the resource folder, as we don't need them for this example.

For the atlassian-plugin.xml we need to do several things. We need to add a web-item which is displayed on the project sidebar, a web-resource which holds all the client resources and a web-panel which will consist of our Angular root element.

The web-item holds the information, where we want to place our icon to access our app. The section `jira.project.sidebar.plugins.navigation` is on the project sidebar. The `iconClass` property defines an icon to display on this sidebar. The link points to the web-panel which we will generate shortly.
<details>
<summary>web-item</summary>

```xml
<web-item key="project-sidebar-item" section="jira.project.sidebar.plugins.navigation">
    <label>Angular in Jira</label>
    <link>/projects/$pathEncodedProjectKey?selectedItem=com.scitotec.angularInJiraEntry</link>
    <param name="iconClass" value="aui-icon-large aui-iconfont-warning"/>
</web-item>
```
</details>

The web-panel item holds the information about the template to render and defines the location, where we can access the rendered velocity template.
<details>
<summary>web-panel</summary>

```xml
<web-panel key="angular-in-jira-entry" location="com.scitotec.angularInJiraEntry">
    <resource name="view" type="velocity" location="index.vm"/>
</web-panel>
```
</details>

The last thing we need is the web-resource. With this entry in the atlassian-plugin.xml we define all the resources which are created during the frontend build process. We also define a context, when these resources should be loaded.
<details>
<summary>web-resource</summary>

```xml
<web-resource key="angularInJira-client" name="angularInJira Web Resources">
    <resource type="download" name="runtime-es2015.js" location="client/runtime-es2015.js" />
    <resource type="download" name="runtime-es5.js" location="client/runtime-es5.js" />
    <resource type="download" name="polyfills-es5.js" location="client/polyfills-es5.js" />
    <resource type="download" name="polyfills-es2015.js" location="client/polyfills-es2015.js" />
    <resource type="download" name="main-es2015.js" location="client/main-es2015.js" />
    <resource type="download" name="main-es5.js" location="client/main-es5.js" />
    <resource type="download" name="styles.css" location="client/styles.css" />
    <context>angularInJira-client</context>
</web-resource>
```
</details>

The next step is to create a Velocity template, which holds the Angular root element and loads all the web-resources for the Angular app. That is pretty straight forward and requires only 2 lines of code:
<details>
<summary>index.vm</summary>

```html
<app-root></app-root>
$webResourceManager.requireResourcesForContext("angularInJira-client")
```
</details>

We will put this file at the root of our resources folder and call it `index.vm` so that the web-panel we defined earlier can render it.

<a name="start"></a>
### Take the Plugin for a spin
Now that we have created all the files and modified all the existing files, we should be able to start up Jira and see the plugin in action. For that we just need to type
```bash
atlas-run
```
in the terminal to boot up Jira with the plugin installed and we are ready to go. But beware, this can take quite some time. I would say up to 5 minutes is normal for the first bootup. After it has finished starting, you should see something like:
```bash
jira started successfully in 231s at http://localhost:2990/jira
```
Now you need to browse to this address and you should see the Jira login screen. You can login with the username `admin` and the password (also) `admin`. The first time the startup wizard should present itself to you. Just fill it out and create a demo project. When you are in the project centric view, with the sidebar to the left, you can see the icon of the app. Click on it and the Angular app is there in it's full glory.

<a name="bonus"></a>
## BONUS: Use aui for your dev client
If you want to use `ng serve` for developing your app (which is the method I use in all my projects) but still want to see, how it would look like with the right Atlassian CSS styles don't fear that you can't do that. This section of the guide is here to your rescue :) 

You have to add the Atlassian aui package via npm
```bash
npm i @atlassian/aui
```
You don't need these styles all the time, only for the development build. For the production, the styles are added by Atlassian and we don't need to worry about that. So how do we achive that? It's quite simple. You can define file replacements for different builds in the `angular.json` file. So you create a new style.scss for production and call it `styles.prod.scss`. Now in the regular `styles.css` you add the following line:
```scss
@import '~@atlassian/aui/dist/aui/aui-prototyping.css';
```
In the angular.json you add the following file replacement entry in the production build:
<details>
<summary>angular.json</summary>

```json
[...]
"configurations": {
  "production": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }, {
      "replace": "src/styles.scss",
      "with": "src/styles.prod.scss"
    }],
    "optimization": true,
[...]
```

</details>
And that's it. You now have all the Atlassian styles in you dev-app and in the final production build.
