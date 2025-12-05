// Wait for the document to load before running the script 
(function ($) {
  
  // We use some Javascript and the URL #fragment to hide/show different parts of the page
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#Linking_to_an_element_on_the_same_page
  $(window).on('load hashchange', function(){
    
    // First hide all content regions, then show the content-region specified in the URL hash 
    // (or if no hash URL is found, default to first menu item)
    $('.content-region').hide();
    
    // Remove any active classes on the main-menu
    $('.main-menu a').removeClass('active');
    var region = location.hash.toString() || $('.main-menu a:first').attr('href');
    
    // Now show the region specified in the URL hash
    $(region).show();
    
    // Highlight the menu link associated with this region by adding the .active CSS class
    $('.main-menu a[href="'+ region +'"]').addClass('active'); 

    // Alternate method: Use AJAX to load the contents of an external file into a div based on URL fragment
    // This will extract the region name from URL hash, and then load [region].html into the main #content div
    // var region = location.hash.toString() || '#first';
    // $('#content').load(region.slice(1) + '.html')
    
  });
  
})(jQuery);

// Handle sub-menu navigation within Projects
$(document).on('click', '.sub-menu a', function(e) {
  e.preventDefault();
  
  // Remove active class from all sub-menu links
  $('.sub-menu a').removeClass('active-project');
  
  // Add active class to clicked link
  $(this).addClass('active-project');
  
  // Hide all project content
  $('.project-content').removeClass('active-project-content');
  
  // Show the target project content
  const targetId = $(this).attr('href');
  $(targetId).addClass('active-project-content');
});


// Add this function to your existing script.js file

document.addEventListener('DOMContentLoaded', () => {
  // ... existing initialization code ...
  
  const thoughtsSection = document.getElementById('thoughts');

  // Use event delegation on the main thoughts section
  thoughtsSection.addEventListener('click', (event) => {
      
      // 1. Check if the click was inside the main article container
      const articleBox = event.target.closest('.article');
      if (!articleBox) return;

      // Find the content elements within this specific article box
      const fullContent = articleBox.querySelector('.full-content');
      const expandButton = articleBox.querySelector('[data-action="expand"]');
      const collapseButton = articleBox.querySelector('[data-action="collapse"]');

      if (!fullContent) return; // Exit if no content is found
      
      const isCurrentlyExpanded = !fullContent.classList.contains('hidden-content');
      const targetElement = event.target.closest('A') || event.target.closest('[data-action]');


      // --- LOGIC BRANCHING ---

      // A. Handle CLICKS on a Button or Link
      if (targetElement) {
          
          // If it's a regular link (A tag), let the browser handle it.
          if (targetElement.tagName === 'A') {
              return;
          }

          // If it's the specific COLLAPSE button
          if (targetElement.getAttribute('data-action') === 'collapse') {
              event.preventDefault(); // Stop the click from bubbling up and re-expanding
              fullContent.classList.add('hidden-content');
              if (expandButton) expandButton.style.display = 'inline-block';
              if (collapseButton) collapseButton.style.display = 'none';
          }
          // If it's the EXPAND button, we fall through to the general expansion logic below.
          
      } 
      
      // B. Handle Clicks ANYWHERE ELSE IN THE BOX (Expansion only)
      
      // If the article is NOT already expanded AND the click wasn't explicitly to collapse:
      if (!isCurrentlyExpanded) {
           // 1. Check if the click was on the text selection (to prevent collapse after highlighting)
           // This uses a timeout because the 'mouseup' event (end of selection) often triggers a click.
           // We can't perfectly filter selection clicks, but we can ensure expansion happens.
          
          // 2. Perform Expansion
          fullContent.classList.remove('hidden-content');
          if (expandButton) expandButton.style.display = 'none';
          if (collapseButton) collapseButton.style.display = 'block';
      }
  });

  // Initial setup: Hide all close buttons when the page loads
  thoughtsSection.querySelectorAll('.close-toggle').forEach(el => {
      el.style.display = 'none';
  });
});