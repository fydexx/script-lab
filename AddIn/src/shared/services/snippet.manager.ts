import {Injectable} from '@angular/core';
import {Http} from '@angular/http';
import {ISnippet, Snippet, SnippetService} from '../services';
import {StorageHelper, Utilities, ContextType, MessageStrings, ExpectedError, UxUtil} from '../helpers';

@Injectable()
export class SnippetManager {
    private _snippetsContainer: StorageHelper<ISnippet>;

    constructor(private _service: SnippetService) {
        this._snippetsContainer = new StorageHelper<ISnippet>('snippets');
    }

    new(): Promise<Snippet> {
        return new Promise(resolve => {
            var snippet: Snippet;
            if (Utilities.context == ContextType.Web) {
                snippet = this._createBlankWebSnippet();
            } else {
                snippet = this._createBlankOfficeJsSnippet();
            }

            snippet.makeNameUnique(false /*isDuplicate*/);
            resolve(this._addSnippetToLocalStorage(snippet));
        });
    }

    save(snippet: Snippet): Promise<ISnippet> {
        if (Utilities.isNull(snippet) || Utilities.isNull(snippet.meta)) return Promise.reject(new Error('Snippet metadata cannot be empty')) as any;
        if (Utilities.isEmpty(snippet.meta.name)) return Promise.reject(new Error('Snippet name cannot be empty')) as any;
        snippet.updateHash();
        return Promise.resolve(this._snippetsContainer.insert(snippet.meta.id, snippet));
    }

    delete(snippet: ISnippet, askForConfirmation: boolean): Promise<any> {
        if (Utilities.isNull(snippet) || Utilities.isNull(snippet.meta)) {
            return Promise.reject(new Error('Snippet metadata cannot be empty'));
        }

        var that = this;

        if (askForConfirmation) {
            return UxUtil.showDialog("Delete confirmation",
                    `Are you sure you want to delete the snippet "${snippet.meta.name}"?`, ['Yes', 'No'])
                .then((choice) => {
                    if (choice = 'Yes') {
                        return deleteAndResolvePromise();
                    } else {
                        return Promise.reject(new ExpectedError());
                    }
                })
        } else {
            return deleteAndResolvePromise();
        }
        
        function deleteAndResolvePromise(): Promise<any> {
            that._snippetsContainer.remove(snippet.meta.id)
            return Promise.resolve();
        }
    }

    deleteAll(askForConfirmation: boolean): Promise<any> {
        var that = this;

        if (askForConfirmation) {
            return UxUtil.showDialog("Delete confirmation",
                    "Are you sure you want to delete *ALL* of your local snippets?", ['Yes', 'No'])
                .then((choice) => {
                    if (choice = 'Yes') {
                        return deleteAndResolvePromise();
                    } else {
                        return Promise.reject(new ExpectedError());
                    }
                })
        } else {
            return deleteAndResolvePromise();
        }
        
        function deleteAndResolvePromise(): Promise<any> {
            that._snippetsContainer.clear();
            return Promise.resolve();
        }
    }

    getLocal(): ISnippet[] {
        return this._snippetsContainer.values();
    }

    getPlaylist(): Promise<any> {
        return Promise.resolve(this._playlist)
            .then(data => {
                return {
                    name: data.name,
                    items: _.groupBy(data.snippets, item => item.group)
                };
            })
            .then(data => {
                var remappedArray = _.map(data.items, (value, index) => {
                    return {
                        name: index,
                        items: value
                    }
                });

                return {
                    name: data.name,
                    items: remappedArray
                }
            })
    }

    import(privateLink: string): Promise<Snippet> {
        var id: string = null;

        var regex = /^^(https?:\/\/[^/]+)\/(?:api\/)?snippets\/([0-9a-z]+)\/?$/;
        var matches = regex.exec(privateLink);

        if (!Utilities.isEmpty(matches)) id = matches[2];
        else {
            var altRegex = /^[0-9a-z]+$/;
            if (!altRegex.test(privateLink)) return Promise.reject<any>(new Error(MessageStrings.InvalidSnippetIdOrUrl));
            id = privateLink;
        }

        return this._service.get(id).then(snippet => {
            snippet.makeNameUnique(false /*isDuplicate*/);
            return this._addSnippetToLocalStorage(snippet);
        }).catch(UxUtil.showErrorNotification);
    }

    find(id: string): Promise<Snippet> {
        return new Promise(resolve => {
            var result = this._snippetsContainer.get(id);
            resolve(new Snippet(result));
        });
    }

    duplicate(snippet: ISnippet): Promise<Snippet> {
        return new Promise(resolve => {
            if (Utilities.isNull(snippet)) throw "Snippet cannot be null."
            var newSnippet = new Snippet(snippet);
            newSnippet.randomizeId(true);
            newSnippet.makeNameUnique(true /*isDuplicate*/);
            resolve(this._addSnippetToLocalStorage(newSnippet));
        });
    }

    publish(snippet: ISnippet, password?: string): Promise<Snippet> {
        return this._service.create(snippet.meta.name, password)
            .then(data => {
                snippet.meta.id = data.id;
                snippet.meta.key = data.password;
            })
            .then(data => this._uploadAllContents(snippet));
    }

    update(snippet: ISnippet, password: string): Promise<any> {
        if (Utilities.isEmpty(snippet.meta.name)) return Promise.reject(new Error('Snippet name cannot be empty'));
        if (Utilities.isEmpty(snippet.meta.id)) return Promise.reject(new Error('Snippet id cannot be empty'));
        return this._uploadAllContents(snippet);
    }

    private _uploadAllContents(snippet: ISnippet): Promise<Snippet> {
        if (Utilities.isNull(snippet) || Utilities.isNull(snippet.meta)) {
            return Promise.reject<any>(new Error('Snippet metadata cannot be empty'));
        }
        return Promise.all([
            this._service.upload(snippet.meta, snippet.ts, 'js'),
            this._service.upload(snippet.meta, snippet.html, 'html'),
            this._service.upload(snippet.meta, snippet.css, 'css'),
            this._service.upload(snippet.meta, snippet.extras, 'extras')
        ]).then(() => snippet);
    }

    private _addSnippetToLocalStorage(snippet: Snippet) {
        this._snippetsContainer.add(snippet.meta.id, snippet);
        return snippet;
    }

    private _playlist = {
        name: 'Microsoft',
        snippets: [
            {
                id: 'abc',
                name: 'Set range values',
                group: 'Range Manipulation'
            },
            {
                id: 'abc',
                name: 'Set cell ranges',
                group: 'Range Manipulation'
            },
            {
                id: 'abc',
                name: 'Set formulas',
                group: 'Range Manipulation'
            },
            {
                id: 'abc',
                name: 'Set background',
                group: 'Range Manipulation'
            },
            {
                id: 'abc',
                name: 'Set range values',
                group: 'Tables'
            },
            {
                id: 'abc',
                name: 'Set range values',
                group: 'Tables'
            },
            {
                id: 'abc',
                name: 'Set cell ranges',
                group: 'Tables'
            },
            {
                id: 'abc',
                name: 'Set formulas',
                group: 'Tables'
            },
            {
                id: 'abc',
                name: 'Set background',
                group: 'Tables'
            }
        ]
    };

    private _createBlankOfficeJsSnippet(): Snippet {
        return new Snippet({
            ts: Utilities.stripSpaces(`
                ${getNamespace()}.run(function(context) {
                    // ...
                    return context.sync();
                }).catch(function(error) {
                    console.log(error);
                    if (error instanceof OfficeExtension.Error) {
                        console.log("Debug info: " + JSON.stringify(error.debugInfo));
                    }
                });
            `),
            extras: Utilities.stripSpaces(`
                // Office.js CDN reference
                https://appsforoffice.microsoft.com/lib/1/hosted/Office.js

                // NPM CDN references
                jquery
                office-ui-fabric/dist/js/jquery.fabric.min.js
                office-ui-fabric/dist/css/fabric.min.css
                office-ui-fabric/dist/css/fabric.components.min.css

                // IntelliSense definitions
                https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/office-js/office-js.d.ts
                https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/jquery/jquery.d.ts
            `)
        });

        function getNamespace() {
            switch (Utilities.context) {
                case ContextType.Excel:
                    return 'Excel';
                case ContextType.Word:
                    return 'Word';
                default:
                    throw new Error("Invalid context type for Office namespace");
            }
        }
    }

    private _createBlankWebSnippet(): Snippet {
        return new Snippet({
            ts: Utilities.stripSpaces(`
                console.log("Hello world");
            `),
            extras: Utilities.stripSpaces(`
                // NPM CDN references
                jquery

                // IntelliSense definitions
                https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/jquery/jquery.d.ts
            `)
        });
    }
}