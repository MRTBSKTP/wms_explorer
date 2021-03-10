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
const ul_requests = div_capabilities_container.querySelector('#requests');
const ul_layers = div_capabilities_container.querySelector('#layers');


// HTMLCollection to array for more loop friendly data type
let td_array = Array.from(td_collection);


// Service Object. Will ease the management of various properties related to service being examined
function Service(title, version, contact_org, constraints, fees, requests, layers) {
    this.title = title;
    this.version = version;
    this.contact_org = contact_org;
    this.constraints = constraints;
    this.fees = fees;
    this.requests = requests; // this is an array
    this.layers = layers; // this is an array
}

// Declaring here to escape it from callback's scope and to not fall into closure hell
let myService;

// Adding a "current" property to list wrappers to apply some transitions
ul_wrappers.forEach(wrapper => {
    wrapper["current"] = null;
    wrapper["past"] = null;
});

/*
    Request:
    A callback function will be invoked when user clicks the request button
*/

let flag = 0;

// fetching with async await sytnax, allows finer control on async processes
async function fetchCapabilities (event) {

    // Disable button and input for a short time
    event.target.disabled = true;
    input_url.disabled = true;
    event.target.style.backgroundColor = "#696969";
    event.target.style.cursor = 'progress'
    document.body.style.cursor = 'progress';

    // First clear leftover modifications from previous invocations
    if (flag===1) {
        td_array.forEach(td => {
            td.className = '';
            td.textContent = '';
        });

        ul_wrappers.forEach(wrapper => {
            wrapper.style.overflowY = 'hidden';
            wrapper.current.setAttribute('slide','out');
            wrapper.current.setAttribute('to','right');
        });
        
        setTimeout(()=>{
            ul_wrappers.forEach(wrapper => {
                let to_delete = Array.from(wrapper.querySelectorAll('.capability_detail'));
                to_delete.forEach(item => {wrapper.removeChild(item)});
            });
            while (ul_requests.lastChild) {
                ul_requests.removeChild(ul_requests.lastChild)
            } 
            while (ul_layers.lastChild) {
                ul_layers.removeChild(ul_layers.lastChild)
            } 
            
            ul_requests.style.height = 'initial';
            ul_layers.style.height = 'initial';

            ul_requests.setAttribute('slide','');
            ul_layers.setAttribute('to','');
        },  800);
        
    } else {flag = 1;}

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
        contant_org = service_node.getElementsByTagName('ContactOrganization')[0].firstChild.nodeValue,
        constraints = service_node.getElementsByTagName('AccessConstraints')[0].firstChild.nodeValue,
        fees = service_node.getElementsByTagName('Fees')[0].firstChild.nodeValue,
        requests = Array.from(request_node.children),
        layers = Array.from(xml_DOM.querySelectorAll('Capability>Layer>Layer'))
    );

    // Populating the service table with a fancy gradual appearing look.
    let myCounter = 0;
    let myInterval = setInterval(()=>{
        let td = td_array[myCounter];
        let data = myService[`${td.id}`];
        td.textContent = data;
        // make things appear on the page, this approach more SEO friendly than 'visibility hidden'
        td.className = 'ready';
        myCounter++;
        if (myCounter === td_array.length) {

            // Restyle button and input to initial status
            event.target.disabled = false;
            input_url.disabled = false;
            event.target.style.backgroundColor = '#004346';
            event.target.style.cursor = 'initial'
            document.body.style.cursor = 'initial';

            clearInterval(myInterval);
            // Also filling the elements concerning request types and layers
            let request_tagNames = myService.requests.map(element => element.tagName);
            fillList(ul_requests, request_tagNames);
            
            let layer_titles = myService.layers.map(element => element.querySelector('Title').firstChild.nodeValue);
            fillList(ul_layers, layer_titles);

             // Show scrollbars if necessary
             ul_wrappers.forEach(wrapper => {
                wrapper.style.overflowY = 'auto';
            });

            ul_wrappers[0].current = ul_requests;
            ul_wrappers[1].current = ul_layers;

            ul_wrappers[0].current.setAttribute("slide", "in");
            ul_wrappers[0].current.setAttribute("to","left");
            ul_wrappers[1].current.setAttribute("slide", "in");
            ul_wrappers[1].current.setAttribute("to","left");

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
    if (event.target.parentNode.className === 'capabilities_list_view_detail') {

        // Hide the ul element and store it at the past property of wrapper
        event.target.parentNode.parentNode.past = event.target.parentNode; 
        event.target.parentNode.setAttribute('slide','out');
        event.target.parentNode.setAttribute('to','left');

        let detail_view;
        switch (event.target.parentNode.id) {
            case "requests":
                detail_view = getRequestDetails(event.target.textContent, event.target.parentNode.parentNode);
                break;
            case "layers":
                detail_view = getLayerDetails(event.target.textContent, event.target.parentNode.parentNode);
                break;
            default:
                // if neither true:
                break;
        }
        
        if (detail_view) {
            // This height trick allows us to use relative positioning just like absolute
            event.target.parentNode.style.height = 0;

            // add the new element
            event.target.parentNode.parentNode.appendChild(detail_view);
        
            // Change the current property of wrapper
            event.target.parentNode.parentNode.current = detail_view;

            setTimeout(() => {
                // Show the new element
                event.target.parentNode.parentNode.current.setAttribute('slide','in');
                event.target.parentNode.parentNode.current.setAttribute('to','left');        
            }, 600);
        }
    }
}

/*
*   Function for extracting useful details about requests
*/
function getRequestDetails(requestName, wrapper) {
    // DOM element to show details
    let requestDetail = document.createElement('ul');
    requestDetail.classList.toggle('capability_detail');
    requestDetail.id = 'request_detail';
    
    let _reqName = document.createElement('li');
    _reqName.textContent = requestName;
    // Wrapper is for sliding the next element in
    let _backArrow = createBackButton(wrapper);
    _reqName.appendChild(_backArrow);
    requestDetail.appendChild(_reqName);

    let _formatItem = document.createElement('li');
    _formatItem.textContent = 'Formatlar';
    _formatItem.setAttribute('subheader','true');
    requestDetail.appendChild(_formatItem);
    
    let myRequest = myService.requests.filter(item => item.tagName === requestName)[0];
    // Extract 'Format' tags and present it as a list
    let formats = Array.from(myRequest.querySelectorAll('Format'));

    formats.forEach(node => {
        let _li = document.createElement('li');
        _li.textContent = node.firstChild.nodeValue;
        requestDetail.appendChild(_li);
    })
    
    return requestDetail;
}

/*
*   Function for extracting useful details about layers
*/
function getLayerDetails(layerTitle, wrapper) {

    // DOM element to show details
    let layerDetail 
    let _lyrName = document.createElement('li');
    _lyrName.textContent = layerTitle;
    // Wrapper is for sliding the next element in
    let _backArrow = createBackButton(wrapper);
    _lyrName.appendChild(_backArrow);
    
    // query if layer has sublayers
    let layerNode = myService.layers.filter(
        layer => layer.querySelector('Title').firstChild.nodeValue === layerTitle
        )[0];

    let nodeList = Array.from(layerNode.querySelectorAll('Layer'));
    if (nodeList) {
        // If layer contains more sub layers
        layerDetail = wrapper.current.cloneNode() // No need for deep cloning because we don't want text nodes
        layerDetail.classList.add('capabilities_list_view_detail');
        layerDetail.appendChild(_lyrName);
        let layerNames = nodeList.map(element => element.querySelector('Title').firstChild.nodeValue);
        fillList(layerDetail, layerNames);
    } else {
        layerDetail = document.createElement('ul');
        layerDetail.classList.toggle('capability_detail');
        layerDetail.id = 'layer_detail';
        layerDetail.appendChild(_lyrName);
    }
    return layerDetail;
}

/*
*   Encapsulates logic for creating and adding back buttons for sub menus
*/ 
function createBackButton (wrapper) {
    let _backArrow = document.createElement('img');
    _backArrow.setAttribute('src', '../styles/chevron-circle-left-solid.svg')
    _backArrow.classList.toggle('back')
    // This reference will ease access
    _backArrow["wrapper"] = wrapper;

    _backArrow.addEventListener('click', (event) => {
        // slide out current detail view
        event.target.parentNode.parentNode.setAttribute("slide","out");
        event.target.parentNode.parentNode.setAttribute("to","right");

        // exchange the current and past properties using destructuring syntax
        [event.target.wrapper.current, event.target.wrapper.past] = [event.target.wrapper.past, event.target.parentNode.parentNode];

        // slide in new current after previous slide out ends
        setTimeout(function() {
            event.target.wrapper.removeChild(event.target.wrapper.past);
            event.target.wrapper.past = null;
            event.target.wrapper.current.style.height = "initial";
            event.target.wrapper.current.setAttribute("slide","in");
            event.target.wrapper.current.setAttribute("to","right");
        }, 600);
    });

    return _backArrow;
}


button_request.addEventListener('click', fetchCapabilities);