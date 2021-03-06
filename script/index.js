/*
    This page makes GetCapabilities Requests to WMS services and parses the
    responses to outline useful information about service like supported
    request types, available layers and their bboxes if any exist. 

    WMS 1.3.0 <-> 1.1.X compliance is aimed,

    Mert Beşiktepe 2021 ITU
*/

/*
    DOM Referencing:
    First group of variables are for direct DOM manipulation ops. and the map
    variable will hold leaflet web map

*/
// References to default elements
const input_url = document.querySelector('#service_url');
const button_request = document.querySelector('#fire_request');
const table_service = document.querySelector('#service');
const td_collection = table_service.getElementsByTagName('td')
const section_details = document.querySelector('#capabilities_tag');
const ul_capabilities_header = document.querySelector('#capabilities_list_view_header');
const div_capabilities_container = document.querySelector('#capabilities_list_view_container');
const ul_wrappers = Array.from(div_capabilities_container.querySelectorAll('.list_wrapper'));
const ul_requests = document.querySelector('#requests');
const ul_layers = document.querySelector('#layers');

// HTMLCollection to array for more loop friendly data type
let td_array = Array.from(td_collection);

// Service Object. Will ease the management of various properties related to service being examined
function Service(title, version, contact_person, contact_org, constraints, fees, requests, layers) {
    this.title = title;
    this.version = version;
    this.contact_person = contact_person;
    this.contact_org = contact_org;
    this.constraints = constraints;
    this.fees = fees;
    this.requests = requests; // this is an array
    this.layers = layers; // this is an array
}

// Declaring here to escape it from callback's scope and to not fall into closure hell
let myService;

/*
    Request:
    A callback function will be invoked when user clicks the request button
*/

let flag = 0;

// fetching with async await sytnax, allows finer control on async processes
async function fetchCapabilities () {

    // First clear leftover modifications from previous invocations
    if (flag) {
        td_array.forEach(td => {
            td.className = '';
            td.textContent = '';
        });

        ul_requests.setAttribute('slide','out');
        ul_layers.setAttribute('slide','out');
    
        setTimeout(()=>{
            while (ul_layers.lastChild) {
                ul_layers.removeChild(ul_layers.lastChild);
            }
            while (ul_requests.lastChild) {
                ul_requests.removeChild(ul_requests.lastChild);
            }

            ul_requests.setAttribute('slide','');
            ul_layers.setAttribute('slide','');

        }, 800);

        flag != flag;
    }

    flag = 1;
    
    // Obtain target URL
    let targetURLStr = input_url.value;

    // End invocation if empty URL string case
    if (!(targetURLStr)) {
        return 1
    }

    // Normalize into lowercase
    targetURLStr = targetURLStr.toLowerCase()

    // Constructing GetCapabilities request
    let targetURL = new URL(targetURLStr);

    // adding the query parameters (URLSearchParams interface)
    if (!(targetURL.searchParams.get('service'))) {
        // service query param doesn't exist
        targetURL.searchParams.set('service','WMS');    
    }
    targetURL.searchParams.set('request','getcapabilities');

    let request_config = {
        method:'GET',
        /*mode:'cors'*/
    };

    let request = new Request(targetURL, request_config);

    // wait till fetch promise resolves, read the response body and return the contents
    let responseText = await fetch(request).then(response => {
        // Check if response status OK
        if (response.status == 200) {
            return response.text()
        }
    }).catch(console.log);

    /* 
        Parsing the XML    
    */
    // Inside of this function's context responseBody variable is a string and more 
    // straightforward to use rather than handling a promise.

    // Preparing DOM for XML data, first we need the parse the string, then create the
    // DOM accordingly
    let xml_parser = new DOMParser();
    let xml_DOM = xml_parser.parseFromString(responseText, 'text/xml');

    // Accesing the service  and capabilit tag nodes, below ops. could be carried on root 
    // node/dom object this is simply a design decision. DOM selectors are case sensitive!
    let service_node = xml_DOM.querySelector('Service');
    let capability_node = xml_DOM.querySelector('Capability');

    /*
    Per WMS specification:
    <Capabilities>
        <Request>
            <GetMap>
        <Layer> -> This one might have a nested structure!
            <Layer> -> those are the queryable ones!
    Since Layer node tend to be bloated, i will only extract queryable layer nodes
    */
    let request_node = capability_node.querySelector('Request');
    
    // Service instance
    myService = new Service(
        title = service_node.getElementsByTagName('Title')[0].firstChild.nodeValue,
        version = service_node.parentNode.getAttribute('version'),
        contact_person = service_node.getElementsByTagName('ContactPerson')[0].firstChild.nodeValue,
        contant_org = service_node.getElementsByTagName('ContactOrganization')[0].firstChild.nodeValue,
        constraints = service_node.getElementsByTagName('AccessConstraints')[0].firstChild.nodeValue,
        fees = service_node.getElementsByTagName('Fees')[0].firstChild.nodeValue,
        requests = Array.from(request_node.children),
        layers = Array.from(capability_node.querySelectorAll('Layer > Layer'))
    );

    // Populating the service table with a fancy gradual appearing look.
    let myCounter = 0;
    let myInterval = setInterval(()=>{
        let td = td_array[myCounter];
        let data = myService[`${td.id}`];
        td.textContent = data;
        // make things appear on the page, this approach more SEO friendly than visibility hack
        td.className = 'ready';
        myCounter++;
        if (myCounter === td_array.length) {
            clearInterval(myInterval);
            // Also filling the elements concerning request types and layers
            let request_tagNames = myService.requests.map(element => element.tagName);
            fillList(ul_requests, request_tagNames);
            
            let layer_titles = myService.layers.map(element => element.querySelector('Title').firstChild.nodeValue);
            fillList(ul_layers, layer_titles);
            // Fire the animation
            ul_requests.setAttribute('slide','in');
            ul_layers.setAttribute('slide','in');

            // Show scrollbars if necessary
            ul_wrappers.forEach(wrapper => {
                wrapper.style.overflowY = 'auto';
            });
        }

        // Add an event listener to details container to catch further clicks,
        // we can utilize event bubbling/capturing mechanism get rid of adding
        // seperate listeners to all chil items
        div_capabilities_container.addEventListener('click', delegateToChild);

    },200);
}

/*
*   Callback for filling the requests and layers lists
*/
function fillList(listElement, dataArray) {
    for (let i=0; i<dataArray.length; i++) {
        // Create a list item for each entry
        let li = document.createElement('li');
        li.textContent = dataArray[i];
        // Add to page 
        listElement.appendChild(li);
    }
}

/*
*   This function is used for pinpointing and delegating the
*   event to accurate children of parent object.
*/
function delegateToChild(event) {

    // Further delegate to next callback for process based on target element
    if (event.target.parentNode.className = 'capabilities_list_view_detail') {
        switch (event.target.parentNode.id) {
            case "requests":
                let _requestDetail = getRequestDetails(event.target.textContent, event.target.parentNode);
                break;
            case "layers":
                let _layerDetail = getLayerDetails(event.target.textContent, event.target.parentNode);
                break;
            default:
                // if neither true:
                break;
        }
        
        // Hide the ul element
        event.target.parentNode.setAttribute('slide','out');
        // Hide scrollbar of list wrapper
        event.target.parentNode.parentNode.style.overflowY = 'hidden';
    }
}

/*
*   Function for extracting useful details about requests
*/
function getRequestDetails(requestName, parentNode) {
    let requestDetail;
    let myRequest = myService.requests.filter(item => item.tagName === requestName)[0];
    // Extract 'Format' tags and present it as a list
    let formats = Array.from(myRequest.querySelectorAll('Format'));
    
    return requestDetail;
}

/*
*   Function for extracting useful details about layers
*/
function getLayerDetails(layerName) {
    let layerDetail;

    return layerDetail;
}


button_request.addEventListener('click', fetchCapabilities);