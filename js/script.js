// Find the date inputs, search button, and gallery on the page.
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const searchButton = document.getElementById('Searchbtn');
const gallery = document.getElementById('gallery');
const photoModal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// Set the date pickers to a recent range and limit them to valid APOD dates.
setupDateInputs(startInput, endInput);

// Fetch and display photos when the button is clicked.
searchButton.addEventListener('click', fetchPhotos);

async function fetchPhotos() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate) {
    showMessage('Please select both a start date and an end date.');
    return;
  }

  if (startDate > endDate) {
    showMessage('The start date must be on or before the end date.');
    return;
  }

  searchButton.disabled = true;
  showMessage('Loading space images...');

  try {
    const photos = await getPhotos(startDate, endDate);
    displayPhotos(photos, startDate, endDate);
  } catch (error) {
    showMessage(`Could not load space images: ${error.message}`);
  } finally {
    searchButton.disabled = false;
  }
}

async function getPhotos(startDate, endDate) {
  const endpoint = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic?api_key=QTFWzcbjDgk788NKwRpRL88BjtfRjfzqcWTGzw8C';
  const perPage = 9;
  let page = 1;
  let totalPages = 1;
  let photos = [];

  // Load each page so longer date ranges are not cut off.
  while (page <= totalPages) {
    const url = new URL(endpoint);
    // The WordPress REST API uses `after` and `before` for date filtering;
    url.searchParams.set('date_from', toLegacyDate(startDate));
    url.searchParams.set('date_to', toLegacyDate(endDate));
    url.searchParams.set('per_page', perPage);
    url.searchParams.set('page', page);

    const response = await fetch(url);

    if (!response.ok) {
      let message = response.statusText;

      try {
        const errorData = await response.json();
        message = errorData.message || message;
      } catch {
        // Keep the HTTP status message if the server did not return JSON.
      }

      throw new Error(`Request failed (${response.status}): ${message}`);
    }

    const pagePhotos = await response.json();

    if (!Array.isArray(pagePhotos)) {
      throw new Error('The API returned data in an unexpected format.');
    }

    // Save this page's entries so they can be displayed later.
    photos.push(...pagePhotos);

    // Use the API's page count, or continue until a page is not full.
    const pagesFromHeader = response.headers.get('X-WP-TotalPages');

    if (pagesFromHeader) {
      totalPages = Number(pagesFromHeader);
    } else if (pagePhotos.length === perPage) {
      totalPages += 1;
    } else {
      totalPages = page;
    }

    page += 1;
  }

  return photos;
}

function displayPhotos(photos, startDate, endDate) {
  // Keep matching images and sort them from earliest date to latest.
  const imagePhotos = photos
    .filter((photo) => (
      photo.date >= startDate
      && photo.date <= endDate
      && photo.media_type === 'image'
      && photo.hdurl
    ))
    .sort((firstPhoto, secondPhoto) => (
      firstPhoto.date.localeCompare(secondPhoto.date)
    ));

  gallery.replaceChildren();

  if (imagePhotos.length === 0) {
    showMessage('No images were found for that date range.');
    return;
  }

  imagePhotos.forEach((photo) => {
    const card = document.createElement('article');
    card.className = 'gallery-item';

    const image = document.createElement('img');
    image.src = photo.hdurl;
    image.alt = photo.alt || photo.title;
    image.loading = 'lazy';

    const title = document.createElement('h2');
    title.textContent = photo.title;

    const date = document.createElement('p');
    date.textContent = photo.date;

    const explanation = document.createElement('p');
    explanation.textContent = getPlainText(photo.explanation);

    // Show the full photo details when the gallery card is clicked.
    card.addEventListener('click', () => {
      modalImage.src = photo.hdurl;
      modalImage.alt = photo.alt || photo.title;
      modalTitle.textContent = photo.title;
      modalDate.textContent = photo.date;
      modalExplanation.textContent = getPlainText(photo.explanation);
      photoModal.showModal();
    });

    card.append(image, title, date);
    gallery.append(card);
  });
}

function getPlainText(html) {
  // The API explanation contains HTML; convert it to readable text safely.
  const explanationDocument = new DOMParser().parseFromString(html, 'text/html');
  return explanationDocument.body.textContent.trim();
}

function showMessage(message) {
  const paragraph = document.createElement('p');
  paragraph.className = 'placeholder';
  paragraph.textContent = message;
  gallery.replaceChildren(paragraph);
}

// Convert YYYY-MM-DD to the API's required YYMMDD format.
function toLegacyDate(date) {
  return date.slice(2).replaceAll('-', '');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
    .register('./service-worker.js')
    .then((registration) =>
      console.log('Service Worker registered with scope:', registration.scope))
    .catch((error) => 
      console.error('Service Worker registration failed:', error));
  });
}

const offlineBanner = document.getElementById('offline-banner');

function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineBanner.classList.add('hidden');
  } else {
    offlineBanner.classList.remove('hidden');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

let deferredInstallPrompt = null;
const installBanner = document.getElementById('install-banner');
const installYesBtn = document.getElementById('install-yes');
const installNoBtn = document.getElementById('install-no');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBanner.classList.remove('hidden');
});

installYesBtn.addEventListener('click', async () => {
  installBanner.classList.add('hidden');
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log(`User response to the install prompt: ${outcome}`);
  deferredInstallPrompt = null;
});

installNoBtn.addEventListener('click', () => {
  installBanner.classList.add('hidden');
});