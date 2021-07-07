;const inputmd_included_iframe_fallback = true;
(function(){
  if(inputmd_included_iframe_fallback){return;}

  setInterval(function(){
    let iframe = document.getElementsByTagName('iframe');
    for(let i = 0; i < iframe.length; i++){
      if(iframe[i].hasAttribute('inputmd_setup')){continue;}
      iframe[i].setAttribute('inputmd_setup', '');
      iframe[i].addEventListener('error', function(e){
        let list = iframe[i].getAttribute('srcFallbackList');
        try{
          list = JSON.parse(list);
        }catch(e){return;}
        if(!list.length){return;}
        e.preventDefault();
        let item = list.shift();
        iframe[i].setAttribute('srcFallbackList', JSON.stringify(list));
        iframe[i].setAttribute('src', item);
      }, {passive: false});
    }
  });

})();
