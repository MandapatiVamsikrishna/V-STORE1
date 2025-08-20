// categories.js — Featured Rows + Mixed Catalog Grid
(function () {
  const grid      = document.getElementById("product-grid");
  const featuredM = document.getElementById("featured-rows");
  const countEl   = document.getElementById("result-count");
  const year      = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

  // Catalog (samples across all departments)
  const PRODUCTS = [
    // Fruits
    { id:"fr-apple",   name:"Red Apples",       price:2.99, rating:4.6, unit:"/ lb",   category:"fruits",     img:"https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?q=80&w=600&auto=format&fit=crop" },
    { id:"fr-orange",  name:"Navel Oranges",    price:3.49, rating:4.2, unit:"/ lb",   category:"fruits",     img:"https://images.unsplash.com/photo-1547514701-42782101795e?q=80&w=600&auto=format&fit=crop" },

    // Vegetables
    { id:"ve-carrot",  name:"Carrots",          price:1.29, rating:4.4, unit:"/ lb",   category:"vegetables", img:"https://images.unsplash.com/photo-1607301405390-8816c2f69c3f?q=80&w=600&auto=format&fit=crop" },
    { id:"ve-broc",    name:"Broccoli",         price:1.99, rating:4.5, unit:"/ head", category:"vegetables", img:"https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=600&auto=format&fit=crop" },

    // Dairy
    { id:"da-milk",    name:"Whole Milk",       price:1.19, rating:4.7, unit:"/ L",    category:"dairy",      img:"https://images.milkandmore.co.uk/image/upload/w_iw/f_auto,q_auto:eco/d_back_up_image.jpg,w_1200,c_scale/v1/products/2004522_2.jpg" },
    { id:"da-cheese",  name:"Cheddar Cheese",   price:3.99, rating:4.6, unit:"/ 200g", category:"dairy",      img:"https://masonfoods.co.uk/wp-content/uploads/2023/08/Untitled-design-13-15.png.webp" },
    { id:"da-yogurt",  name:"Greek Yogurt",     price:0.89, rating:4.3, unit:"/ pot",  category:"dairy",      img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeDrJIasn0IdDhNfKMFSzmL8NhX0OssTpUxg&s" },

    // Eggs
    { id:"eg-large",   name:"Large Eggs",       price:2.99, rating:4.4, unit:"/ dozen",category:"eggs",       img:"https://store.kirbyandlewis.co.uk/wp-content/uploads/2021/01/egg_tray.jpeg" },

    // Meat
    { id:"me-chicken", name:"Chicken Breast",   price:5.99, rating:4.5, unit:"/ lb",   category:"meat",       img:"https://images.unsplash.com/photo-1604908176997-4312621b2b2a?q=80&w=600&auto=format&fit=crop" },
    { id:"me-beef",    name:"Ground Beef",      price:6.49, rating:4.1, unit:"/ lb",   category:"meat",       img:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=600&auto=format&fit=crop" },

    // Seafood
    { id:"sf-salmon",  name:"Atlantic Salmon",  price:9.99, rating:4.6, unit:"/ lb",   category:"seafood",    img:"https://images.unsplash.com/photo-1615141982883-c7ad0d84b0d8?q=80&w=600&auto=format&fit=crop" },

    // Bakery
    { id:"ba-bread",   name:"Sourdough Bread",  price:2.49, rating:4.6, unit:"/ loaf", category:"bakery",     img:"https://images.unsplash.com/photo-1517433670267-08bbd4be890f?q=80&w=600&auto=format&fit=crop" },
    { id:"ba-crois",   name:"Butter Croissants",price:3.29, rating:4.7, unit:"/ 4pk",  category:"bakery",     img:"https://images.unsplash.com/photo-1549931319-a545dcf3bc73?q=80&w=600&auto=format&fit=crop" },

    // Pantry
    { id:"pa-penne",   name:"Penne Pasta",      price:1.09, rating:4.3, unit:"/ 500g", category:"pantry",     img:"https://images.unsplash.com/photo-1586201375754-1421e0aa2fda?q=80&w=600&auto=format&fit=crop" },

    // Beverages
    { id:"be-oj",      name:"Orange Juice",     price:1.79, rating:4.2, unit:"/ 1L",   category:"beverages",  img:"https://images.unsplash.com/photo-1577805947697-89e18249d767?q=80&w=600&auto=format&fit=crop" },
  ];

  const CATEGORY_LINK = {
    fruits:"fruits.html",
    vegetables:"vegetables.html", // adjust if your file is 'vegatables.html'
    dairy:"dairy.html",
    eggs:"eggs.html",
    meat:"meat.html",
    seafood:"seafood.html",
    bakery:"bakery.html",
    pantry:"pantry.html",
    beverages:"beverages.html"
  };

  /* --------- Utilities --------- */
  const starText = (r) =>
    (Math.round(r) >= 5 ? "★★★★★" :
     Math.round(r) === 4 ? "★★★★☆" :
     Math.round(r) === 3 ? "★★★☆☆" :
     Math.round(r) === 2 ? "★★☆☆☆" :
     Math.round(r) === 1 ? "★☆☆☆☆" : "☆☆☆☆☆");

  const cardHTML = (p, small=false) => `
    <article class="card product-item ${small ? "card--sm" : ""}"
      data-id="${p.id}"
      data-name="${p.name}"
      data-price="${p.price}"
      data-category="${p.category}"
      data-rating="${p.rating}">
      <button class="wish" aria-label="Add ${p.name} to wishlist">♡</button>
      <div class="media"><img src="${p.img}" alt="${p.name}" /></div>
      <h3 class="title">${p.name}</h3>
      <div class="meta">
        <span class="rating">${starText(p.rating)}</span>
        <span class="price">£${p.price.toFixed(2)} <span class="muted">${p.unit||""}</span></span>
      </div>
      <div class="actions">
        <div class="qty" data-qty-for="${p.id}">
          <button class="dec" aria-label="Decrease">−</button>
          <span class="q">1</span>
          <button class="inc" aria-label="Increase">+</button>
        </div>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    </article>
  `;

  /* --------- Featured Rows --------- */
  function buildFeaturedRows() {
    if (!featuredM) return;

    // Group by category + sort by rating desc + take top N
    const groups = PRODUCTS.reduce((acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    }, {});
    Object.values(groups).forEach(arr => arr.sort((a,b) => b.rating - a.rating));

    const order = [
      "fruits","vegetables","dairy","eggs","meat","seafood","bakery","pantry","beverages"
    ].filter(k => groups[k]?.length);

    featuredM.innerHTML = "";

    order.forEach(cat => {
      const items = groups[cat].slice(0, 10); // up to 10 per row
      const rowId = `row-${cat}`;
      const viewHref = CATEGORY_LINK[cat] || "#";

      const block = document.createElement("div");
      block.className = "row-block";
      block.setAttribute("role","region");
      block.setAttribute("aria-labelledby", `${rowId}-label`);

      block.innerHTML = `
        <div class="row-header">
          <h3 id="${rowId}-label">${titleCase(cat)}</h3>
          <a class="view-all" href="${viewHref}">View all →</a>
        </div>
        <div class="row-scroller-wrap">
          <div class="row-scroller" id="${rowId}" tabindex="0" aria-label="${titleCase(cat)} carousel">
            ${items.map(p => cardHTML(p, true)).join("")}
          </div>
          <div class="row-nav" aria-hidden="true">
            <button class="row-prev" data-target="${rowId}" title="Scroll left" aria-label="Scroll left">‹</button>
            <button class="row-next" data-target="${rowId}" title="Scroll right" aria-label="Scroll right">›</button>
          </div>
        </div>
      `;
      featuredM.appendChild(block);
    });

    wireRowControls();
  }

  function titleCase(s){ return String(s||"").replace(/(^|\s|-)\S/g, m => m.toUpperCase()); }

  function wireRowControls(){
    // nav buttons
    document.querySelectorAll(".row-prev,.row-next").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-target");
        const scroller = document.getElementById(id);
        if (!scroller) return;
        const amount = scroller.clientWidth * 0.9;
        scroller.scrollBy({ left: btn.classList.contains("row-prev") ? -amount : amount, behavior:"smooth" });
      });
    });

    // drag to scroll (mouse)
    document.querySelectorAll(".row-scroller").forEach(scroller => {
      let isDown=false, startX=0, startLeft=0;
      scroller.addEventListener("mousedown", (e) => {
        isDown=true; scroller.classList.add("drag"); startX=e.pageX; startLeft=scroller.scrollLeft;
      });
      document.addEventListener("mouseup", () => { isDown=false; scroller.classList.remove("drag"); });
      document.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        scroller.scrollLeft = startLeft - dx;
      });

      // keyboard (arrow keys)
      scroller.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const amount = scroller.clientWidth * 0.9;
          scroller.scrollBy({ left: e.key === "ArrowRight" ? amount : -amount, behavior:"smooth" });
        }
      });

      // disable nav buttons when fully scrolled
      const prev = scroller.parentElement.querySelector(".row-prev");
      const next = scroller.parentElement.querySelector(".row-next");
      const updateBtns = () => {
        if (!prev || !next) return;
        prev.disabled = scroller.scrollLeft <= 2;
        const max = scroller.scrollWidth - scroller.clientWidth - 2;
        next.disabled = scroller.scrollLeft >= max;
      };
      scroller.addEventListener("scroll", updateBtns);
      new ResizeObserver(updateBtns).observe(scroller);
      updateBtns();
    });
  }

  /* --------- “All Products” Grid --------- */
  function buildGrid(){
    if (!grid) return;
    grid.innerHTML = PRODUCTS.map(p => cardHTML(p, false)).join("");
    if (countEl) countEl.textContent = `${PRODUCTS.length} items`;
  }

  // Quick-search chips → fill search box then submit (uses global script.js)
  function hookChips() {
    document.querySelectorAll(".chips .chip[data-search]").forEach(btn => {
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-search") || "";
        const input = document.getElementById("search-input");
        const form  = document.getElementById("search-form");
        if (input && form) {
          input.value = q;
          form.dispatchEvent(new Event("submit", { bubbles: true }));
        }
      });
    });
  }

  // Go!
  buildFeaturedRows();
  buildGrid();
  hookChips();
})();
